// KGM 성수서비스센터 홈 동작: 첫 방문 인트로, 상단 공지 롤링, 쇼룸 화면 밖 정지, 주소 복사, 소모품 교환 가이드 팝업
(function () {
  // 첫 방문 인트로: 화면 곳곳에서 차 사고·정비 걱정을 타이핑 → 금색 공이 떨어지며 '꽝' → 글자 픽셀이 흩어졌다가
  // 'KGM 성수서비스센터'로 모여 전기 불빛처럼 켜짐. 세션당 1회, ?intro=1 로 강제 재생, &sound=1 은 소리 미리보기용 시작 버튼
  var root = document.documentElement;
  var intro = document.getElementById('gIntro');
  if (intro && !root.classList.contains('g-intro-on')) {
    intro.parentNode.removeChild(intro);
  } else if (intro) {
    var canvas = intro.querySelector('.g-introFx');
    var cx = canvas.getContext('2d');
    var brand = intro.querySelector('.g-introBrand');
    var nameEl = intro.querySelector('.g-introName');
    var soundBtn = intro.querySelector('.g-introSound');
    var ended = false, raf = 0, t0 = 0;
    var FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    var wait = function (ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    };

    // 이름을 한 글자씩 켜기 위해 글자 단위로 나눔
    var chars = nameEl.textContent.split('').map(function (ch) {
      var s = document.createElement('span');
      s.className = 'g-introChar';
      s.textContent = ch === ' ' ? ' ' : ch;
      return s;
    });
    nameEl.setAttribute('aria-label', nameEl.textContent);
    nameEl.textContent = '';
    chars.forEach(function (s) { nameEl.appendChild(s); });

    // 인트로 사운드: 음원 파일 없이 Web Audio로 합성. 브라우저 정책상 '소리 켜기'를 눌러야 소리가 난다.
    var sound = (function () {
      var AC = window.AudioContext || window.webkitAudioContext;
      var ctx = null, out = null, verb = null, noise = null, on = false, stopped = false, drone = null;
      var setup = function () {
        if (ctx || !AC) return ctx;
        ctx = new AC();
        var comp = ctx.createDynamicsCompressor();
        out = ctx.createGain();
        out.gain.value = 0.7;
        out.connect(comp);
        comp.connect(ctx.destination);
        var len = ctx.sampleRate * 2;
        noise = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = noise.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        var ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (var c = 0; c < 2; c++) {
          var ch = ir.getChannelData(c);
          for (var j = 0; j < len; j++) ch[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 3);
        }
        verb = ctx.createConvolver();
        verb.buffer = ir;
        var wet = ctx.createGain();
        wet.gain.value = 0.35;
        verb.connect(wet);
        wet.connect(out);
        return ctx;
      };
      var env = function (t, peak, attack, decay) {
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
        return g;
      };
      var tone = function (t, f, type, peak, attack, decay, send, dest) {
        var o = ctx.createOscillator(), g = env(t, peak, attack, decay);
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        o.connect(g);
        g.connect(dest || out);
        if (send) g.connect(verb);
        o.start(t);
        o.stop(t + attack + decay + 0.05);
        return o;
      };
      var hiss = function (t, dur, type, f1, f2, peak, attack, send, dest) {
        var s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), a = attack || dur * 0.4, g = env(t, peak, a, dur - a);
        s.buffer = noise;
        s.loop = true;
        fl.type = type;
        fl.frequency.setValueAtTime(f1, t);
        fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
        s.connect(fl);
        fl.connect(g);
        g.connect(dest || out);
        if (send) g.connect(verb);
        s.start(t, Math.random() * 1.5);
        s.stop(t + dur + 0.05);
      };
      var pan = function (p) {
        if (!ctx.createStereoPanner) return out;
        var n = ctx.createStereoPanner();
        n.pan.value = Math.max(-1, Math.min(1, p));
        n.connect(out);
        return n;
      };
      return {
        isOn: function () { return on; },
        enable: function () {
          if (on || stopped || !setup()) return Promise.resolve(false);
          return ctx.resume().then(function () {
            on = ctx.state === 'running';
            return on;
          });
        },
        // 키보드 한 타: 딸깍(고음 잡음) + 톡(저음). 질문마다 좌우 위치를 달리해 여기저기서 치는 느낌
        key: function (p, level) {
          if (!on) return;
          var t = ctx.currentTime + Math.random() * 0.012, d = pan(p);
          hiss(t, 0.02, 'highpass', 2500 + Math.random() * 2500, 6000, 0.1 * level, 0.002, false, d);
          tone(t, 1500 + Math.random() * 900, 'square', 0.012 * level, 0.001, 0.012, false, d);
          tone(t, 140 + Math.random() * 70, 'sine', 0.09 * level, 0.002, 0.04, false, d);
        },
        // 타이핑 동안 낮게 깔리며 점점 올라가는 긴장음
        tension: function (dur) {
          if (!on || drone || dur < 0.3) return;
          var t = ctx.currentTime, g = ctx.createGain(), lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(250, t);
          lp.frequency.exponentialRampToValueAtTime(2400, t + dur);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.08, t + dur);
          lp.connect(g);
          g.connect(out);
          g.connect(verb);
          drone = { g: g, oscs: [55, 55.5, 82.4].map(function (f) {
            var o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(f, t);
            o.frequency.exponentialRampToValueAtTime(f * 2, t + dur);
            o.connect(lp);
            o.start(t);
            return o;
          }) };
        },
        // 공이 떨어지는 동안: 긴장음을 끊어 순간 정적 → 휘익
        fall: function (dur) {
          if (!on) return;
          var t = ctx.currentTime;
          if (drone) {
            drone.g.gain.cancelScheduledValues(t);
            drone.g.gain.setTargetAtTime(0.0001, t, 0.02);
            drone.oscs.forEach(function (o) { o.stop(t + 0.3); });
          }
          var o = tone(t, 1800, 'sine', 0.06, dur * 0.85, dur * 0.15, true);
          o.frequency.exponentialRampToValueAtTime(240, t + dur);
          hiss(t, dur, 'bandpass', 5000, 400, 0.1, dur * 0.9);
        },
        // 꽝: 깊은 저음 + 터지는 잡음 + 길게 남는 울림, 흩어지는 반짝임
        boom: function () {
          if (!on) return;
          var t = ctx.currentTime;
          var o = tone(t, 120, 'sine', 1, 0.003, 1.3);
          o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
          var c = tone(t, 75, 'square', 0.12, 0.002, 0.25, true);
          c.frequency.exponentialRampToValueAtTime(35, t + 0.2);
          hiss(t, 0.9, 'lowpass', 4500, 150, 0.6, 0.004, true);
          hiss(t, 2.2, 'highpass', 5000, 9000, 0.09, 0.004, true);
          for (var i = 0; i < 16; i++) tone(t + 0.08 + Math.random() * 0.9, 2000 + Math.random() * 3200, 'sine', 0.025, 0.002, 0.25, true);
        },
        // 픽셀이 다시 모일 때: 거꾸로 빨려 들어가는 소리
        gather: function (dur) {
          if (!on) return;
          var t = ctx.currentTime;
          hiss(t, dur, 'bandpass', 300, 7000, 0.15, dur * 0.92, true);
          var o = tone(t, 160, 'sawtooth', 0.03, dur * 0.92, 0.08, true);
          o.frequency.exponentialRampToValueAtTime(880, t + dur);
        },
        // 지지직: 불규칙하게 튀는 전기 잡음
        zap: function (len, peak) {
          if (!on) return;
          var t = ctx.currentTime, o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = env(t, peak, 0.003, len);
          o.type = 'square';
          for (var s = 0; s < len; s += 0.018) o.frequency.setValueAtTime(60 + Math.random() * 260, t + s);
          bp.type = 'bandpass';
          bp.frequency.value = 1800;
          bp.Q.value = 0.7;
          o.connect(bp);
          bp.connect(g);
          g.connect(out);
          g.connect(verb);
          o.start(t);
          o.stop(t + len + 0.05);
          hiss(t, len, 'highpass', 3000, 8000, peak * 0.6, 0.002);
        },
        // 이름이 켜질 때: 전원이 들어오는 '지잉' + 낮은 울림
        power: function () {
          if (!on) return;
          var t = ctx.currentTime;
          var o = tone(t, 70, 'sine', 0.55, 0.01, 2.2);
          o.frequency.exponentialRampToValueAtTime(48, t + 1.2);
          var hum = ctx.createBiquadFilter(), g = env(t, 0.06, 0.05, 2.4);
          hum.type = 'lowpass';
          hum.frequency.setValueAtTime(600, t);
          hum.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
          hum.connect(g);
          g.connect(out);
          g.connect(verb);
          [110, 220.6, 330].forEach(function (f) {
            var h = ctx.createOscillator();
            h.type = 'sawtooth';
            h.frequency.setValueAtTime(f * 0.5, t);
            h.frequency.exponentialRampToValueAtTime(f, t + 0.35);
            h.connect(hum);
            h.start(t);
            h.stop(t + 2.5);
          });
          hiss(t, 1.6, 'highpass', 6000, 10000, 0.04, 0.02, true);
        },
        stop: function () {
          if (!ctx || stopped) return;
          stopped = true;
          on = false;
          var c = ctx;
          out.gain.setTargetAtTime(0.0001, c.currentTime, 0.2);
          setTimeout(function () { c.close(); }, 1200);
        }
      };
    })();

    // 질문: [문구, x, y(화면 비율), 기울기(도), 크기 배율, 시작(ms), 한 글자 간격(ms)] — 뒤로 갈수록 빨라져 점점 다급하게
    var LAYOUT_PC = [
      ['사고가 나면 어떻게 하지?', 0.26, 0.2, -7, 1, 400, 70],
      ['사고수리는 어디서 하지?', 0.71, 0.29, 6, 1.1, 700, 64],
      ['내 차 정비는 어디로 가야 하지?', 0.31, 0.5, 3, 1.15, 1000, 58],
      ['보험처리는 어떻게 하지?', 0.77, 0.55, -5, 0.92, 1250, 54],
      ['내 차는 어디서 관리하지?', 0.23, 0.77, 6, 0.95, 1500, 50],
      ['사고상담은 어디서 받아볼 수 있지?', 0.66, 0.82, -3, 1.05, 1720, 46],
      ['믿고 맡길 곳 없을까?', 0.5, 0.66, -11, 0.85, 1920, 42],
      ['수리비는 얼마나 나올까?', 0.48, 0.09, 4, 0.85, 2080, 40],
      ['렌트카는 어떻게 하지?', 0.1, 0.38, -9, 0.8, 2220, 38]
    ];
    var LAYOUT_PHONE = [
      ['사고가 나면 어떻게 하지?', 0.42, 0.16, -6, 1, 400, 68],
      ['사고수리는 어디서 하지?', 0.6, 0.3, 5, 1.05, 720, 60],
      ['내 차 정비는 어디로 가야 하지?', 0.5, 0.46, -3, 1.08, 1040, 54],
      ['내 차는 어디서 관리하지?', 0.4, 0.62, 6, 1, 1340, 48],
      ['사고상담은 어디서 받아볼 수 있지?', 0.55, 0.78, -4, 0.98, 1620, 44],
      ['보험처리는 어떻게 하지?', 0.45, 0.9, 5, 0.95, 1880, 40]
    ];
    var COLORS = ['#ffffff', '#f2cf85', '#bcdcff'];
    var W = 0, H = 0, dpr = 1, phone = false, fs = 40, hit = { x: 0, y: 0 };
    var qs = [], T = {}, P = null, bolts = [], lit = 0, fired = {}, last = 0;

    var prepare = function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = intro.clientWidth;
      H = intro.clientHeight;
      phone = W < 768;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var r = nameEl.getBoundingClientRect();
      hit = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      fs = parseFloat(getComputedStyle(nameEl).fontSize) || 40;
      qs = (phone ? LAYOUT_PHONE : LAYOUT_PC).map(function (q, i) {
        var size = (phone ? 14 : 19) * q[4];
        cx.font = '500 ' + size + 'px ' + FONT;
        var w = cx.measureText(q[0]).width + size * 3.6;
        return {
          text: q[0], x: Math.min(Math.max(q[1] * W, w / 2 + 8), W - w / 2 - 8), y: q[2] * H, rot: q[3] * Math.PI / 180,
          size: size, w: w, h: size * 2.6, start: q[5], speed: q[6], n: 0, pan: (q[1] - 0.5) * 1.6, level: 0.6 + i * 0.1
        };
      });
      var end = Math.max.apply(null, qs.map(function (q) { return q.start + q.text.length * q.speed; }));
      T.drop = end + 380;
      T.impact = T.drop + 520;
      T.gather = T.impact + 750;
      T.reveal = T.gather + 1300;
      T.sub = T.reveal + 700;
      T.end = T.reveal + 2800;
    };

    var pill = function (x, y, w, h) {
      var r = h / 2;
      cx.beginPath();
      cx.moveTo(x + r, y);
      cx.arcTo(x + w, y, x + w, y + h, r);
      cx.arcTo(x + w, y + h, x, y + h, r);
      cx.arcTo(x, y + h, x, y, r);
      cx.arcTo(x, y, x + w, y, r);
      cx.closePath();
    };
    // 기울어진 작은 검색창 하나 (돋보기 + 타이핑 중인 문구 + 커서)
    var drawQ = function (q, t, shake) {
      var a = Math.min(1, (t - q.start + 200) / 250);
      if (a <= 0) return;
      var s = q.size, lx = -q.w / 2 + s * 1.3, sc = 0.92 + 0.08 * a;
      cx.save();
      cx.globalAlpha = a;
      cx.translate(q.x + (Math.random() - 0.5) * shake, q.y + (Math.random() - 0.5) * shake);
      cx.rotate(q.rot);
      cx.scale(sc, sc);
      pill(-q.w / 2, -q.h / 2, q.w, q.h);
      cx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      cx.fill();
      cx.lineWidth = 1;
      cx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
      cx.stroke();
      cx.lineWidth = Math.max(1.5, s * 0.1);
      cx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      cx.beginPath();
      cx.arc(lx, -s * 0.08, s * 0.32, 0, Math.PI * 2);
      cx.moveTo(lx + s * 0.23, s * 0.15);
      cx.lineTo(lx + s * 0.5, s * 0.42);
      cx.stroke();
      cx.font = '500 ' + s + 'px ' + FONT;
      cx.textBaseline = 'middle';
      cx.fillStyle = '#fff';
      var shown = q.text.slice(0, q.n), tx = lx + s * 0.95;
      cx.fillText(shown, tx, s * 0.04);
      if (q.n < q.text.length || Math.floor(t / 420) % 2) {
        cx.fillStyle = '#c4a96c';
        cx.fillRect(tx + cx.measureText(shown).width + 2, -s * 0.62, Math.max(2, s * 0.1), s * 1.24);
      }
      cx.restore();
    };
    var drawBall = function (t) {
      var p = Math.min(1, (t - T.drop) / (T.impact - T.drop)), r = phone ? 11 : 14;
      for (var k = 4; k >= 0; k--) {
        var pk = Math.max(0, p - k * 0.035), y = -40 + (hit.y + 40) * pk * pk;
        var g = cx.createRadialGradient(hit.x - r * 0.3, y - r * 0.4, r * 0.1, hit.x, y, r);
        g.addColorStop(0, '#f6e7bf');
        g.addColorStop(0.55, '#c4a96c');
        g.addColorStop(1, '#8c7445');
        cx.globalAlpha = k ? 0.1 * (5 - k) : 1;
        cx.fillStyle = g;
        cx.beginPath();
        cx.arc(hit.x, y, r, 0, Math.PI * 2);
        cx.fill();
      }
      cx.globalAlpha = 1;
    };

    var shufflePairs = function (a) {
      for (var i = a.length / 2 - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), x = a[i * 2], y = a[i * 2 + 1];
        a[i * 2] = a[j * 2];
        a[i * 2 + 1] = a[j * 2 + 1];
        a[j * 2] = x;
        a[j * 2 + 1] = y;
      }
      return a;
    };
    var samplePixels = function (data, w, h, step, min) {
      var pts = [];
      for (var y = 0; y < h; y += step) {
        for (var x = 0; x < w; x += step) {
          if (data[(y * w + x) * 4 + 3] > min) pts.push(x / dpr + (Math.random() - 0.5) * 0.6, y / dpr + (Math.random() - 0.5) * 0.6);
        }
      }
      return pts;
    };
    // 도착 지점: 화면의 이름 글자와 같은 자리에 글자를 그려 그 픽셀을 씀
    var targets = function () {
      var off = document.createElement('canvas'), o = off.getContext('2d'), cs = getComputedStyle(nameEl);
      var ls = parseFloat(cs.letterSpacing) || 0;
      off.width = canvas.width;
      off.height = canvas.height;
      o.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.fillStyle = '#fff';
      chars.forEach(function (c) {
        var r = c.getBoundingClientRect();
        o.fillText(c.textContent, r.left + (r.width - ls) / 2, r.top + r.height / 2);
      });
      return samplePixels(o.getImageData(0, 0, off.width, off.height).data, off.width, off.height, Math.round(Math.max(2, fs / 24) * dpr), 140);
    };
    // 꽝: 지금 화면의 질문 글자·테두리 픽셀을 그대로 입자로 바꿔 사방으로 날림
    var explode = function () {
      cx.clearRect(0, 0, W, H);
      qs.forEach(function (q) { drawQ(q, 1e9, 0); });
      var src = shufflePairs(samplePixels(cx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, Math.max(1, Math.round(2 * dpr)), 70));
      var tgt = shufflePairs(targets());
      if (!src.length) src = [hit.x, hit.y];
      var sn = Math.min(src.length / 2, phone ? 1500 : 2600), tn = tgt.length / 2, n = Math.max(sn, tn);
      P = { n: n, tn: tn, x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n),
        sx: new Float32Array(n), sy: new Float32Array(n), tx: new Float32Array(n), ty: new Float32Array(n),
        d: new Float32Array(n), sw: new Float32Array(n), k: new Uint8Array(n) };
      for (var i = 0; i < n; i++) {
        var j = (i % sn) * 2, x0 = src[j] + (i >= sn ? (Math.random() - 0.5) * 3 : 0), y0 = src[j + 1] + (i >= sn ? (Math.random() - 0.5) * 3 : 0);
        var dx = x0 - hit.x, dy = y0 - hit.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var sp = (3 + Math.random() * 9) * (phone ? 0.7 : 1) * (0.6 + Math.min(1, 300 / dist) * 0.8);
        P.x[i] = x0;
        P.y[i] = y0;
        P.vx[i] = dx / dist * sp + (Math.random() - 0.5) * 2;
        P.vy[i] = dy / dist * sp + (Math.random() - 0.5) * 2;
        if (i < tn) {
          P.tx[i] = tgt[i * 2];
          P.ty[i] = tgt[i * 2 + 1];
        }
        P.sw[i] = (Math.random() - 0.5) * (phone ? 90 : 160);
        var r = Math.random();
        P.k[i] = r < 0.62 ? 1 : r < 0.86 ? 0 : 2;
      }
    };
    var gatherStart = function () {
      for (var i = 0; i < P.n; i++) {
        P.sx[i] = P.x[i];
        P.sy[i] = P.y[i];
        P.d[i] = Math.random() * 300;
      }
    };
    var drawParticles = function (t, f) {
      var n = P.n, i, gather = t >= T.gather, drag = Math.pow(0.93, f);
      for (i = 0; i < n; i++) {
        var p = gather ? (t - T.gather - P.d[i]) / 1000 : 0;
        if (!gather || p <= 0 || i >= P.tn) {
          P.x[i] += P.vx[i] * f;
          P.y[i] += P.vy[i] * f;
          P.vx[i] *= drag;
          P.vy[i] *= drag;
          if (gather) {
            P.sx[i] = P.x[i];
            P.sy[i] = P.y[i];
          }
        } else if (p < 1) {
          // 소용돌이치듯 휘어 들어오며 글자 자리로
          var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          var dx = P.tx[i] - P.sx[i], dy = P.ty[i] - P.sy[i], len = Math.sqrt(dx * dx + dy * dy) || 1, s = Math.sin(Math.PI * p) * P.sw[i];
          P.x[i] = P.sx[i] + dx * e - dy / len * s;
          P.y[i] = P.sy[i] + dy * e + dx / len * s;
        } else {
          // 도착 후에는 전기가 흐르듯 미세하게 떨림
          P.x[i] = P.tx[i] + (Math.random() - 0.5) * 0.9;
          P.y[i] = P.ty[i] + (Math.random() - 0.5) * 0.9;
        }
      }
      var size = phone ? 1.6 : 2, h = size / 2;
      var fade = t >= T.reveal ? Math.max(0, 1 - (t - T.reveal) / 900) : 1;
      var loose = gather ? Math.max(0, 1 - (t - T.gather) / 700) : 1;
      cx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 3; k++) {
        cx.fillStyle = COLORS[k];
        for (var pass = 0; pass < 2; pass++) {
          var a = pass ? loose * fade : fade, from = pass ? P.tn : 0, to = pass ? n : Math.min(P.tn, n);
          if (a <= 0.01) continue;
          cx.globalAlpha = a;
          for (i = from; i < to; i++) if (P.k[i] === k) cx.fillRect(P.x[i] - h, P.y[i] - h, size, size);
        }
      }
    };
    var strokePath = function (pts) {
      cx.beginPath();
      cx.moveTo(pts[0], pts[1]);
      for (var i = 2; i < pts.length; i += 2) cx.lineTo(pts[i], pts[i + 1]);
      cx.stroke();
    };
    // 이름 글자 사이를 튀는 번개 줄기
    var spawnBolt = function (t) {
      if (!P.tn) return;
      var a = Math.floor(Math.random() * P.tn), ax = P.tx[a], ay = P.ty[a], bx = ax, by = ay, tries = 0;
      do {
        var b = Math.floor(Math.random() * P.tn);
        bx = P.tx[b];
        by = P.ty[b];
      } while (++tries < 6 && Math.abs(bx - ax) + Math.abs(by - ay) > fs * 2.2);
      var pts = [ax, ay];
      for (var s = 1; s < 7; s++) {
        pts.push(ax + (bx - ax) * s / 7 + (Math.random() - 0.5) * fs * 0.35, ay + (by - ay) * s / 7 + (Math.random() - 0.5) * fs * 0.35);
      }
      pts.push(bx, by);
      bolts.push({ pts: pts, born: t });
      if (Math.random() < 0.3) sound.zap(0.04, 0.025);
    };
    var drawFx = function (t, f) {
      var since = t - T.impact;
      cx.globalCompositeOperation = 'lighter';
      if (since < 700) {
        // 충격파 고리, 번쩍임, 착지점 빛
        var q = since / 700;
        cx.globalAlpha = (1 - q) * 0.8;
        cx.strokeStyle = '#f2cf85';
        cx.lineWidth = 3 * (1 - q) + 0.5;
        cx.beginPath();
        cx.arc(hit.x, hit.y, Math.max(W, H) * 0.9 * (1 - Math.pow(1 - q, 3)), 0, Math.PI * 2);
        cx.stroke();
        if (since < 300) {
          cx.globalAlpha = 0.5 * (1 - since / 300);
          cx.fillStyle = '#fff3d8';
          cx.fillRect(0, 0, W, H);
        }
        var g = cx.createRadialGradient(hit.x, hit.y, 0, hit.x, hit.y, 170);
        g.addColorStop(0, 'rgba(255, 230, 170, 0.9)');
        g.addColorStop(1, 'rgba(255, 230, 170, 0)');
        cx.globalAlpha = 1 - q;
        cx.fillStyle = g;
        cx.fillRect(hit.x - 170, hit.y - 170, 340, 340);
      }
      if (t > T.reveal - 450 && t < T.reveal + 1000 && Math.random() < 0.45 * f) spawnBolt(t);
      bolts = bolts.filter(function (b) { return t - b.born < 110; });
      bolts.forEach(function (b) {
        var a = 1 - (t - b.born) / 110;
        cx.globalAlpha = a * 0.35;
        cx.lineWidth = 4;
        cx.strokeStyle = '#7fb6ff';
        strokePath(b.pts);
        cx.globalAlpha = a;
        cx.lineWidth = 1.2;
        cx.strokeStyle = '#eef6ff';
        strokePath(b.pts);
      });
      cx.globalAlpha = 1;
      cx.globalCompositeOperation = 'source-over';
    };

    var frame = function (now) {
      if (ended) return;
      var t = now - t0, f = Math.min((now - (last || now)) / 16.7, 3);
      last = now;
      cx.globalCompositeOperation = 'source-over';
      cx.globalAlpha = 1;
      cx.clearRect(0, 0, W, H);
      if (t < T.impact) {
        var shake = t > T.drop ? 3 * (t - T.drop) / (T.impact - T.drop) : 0;
        qs.forEach(function (q) {
          var n = Math.max(0, Math.min(q.text.length, Math.floor((t - q.start) / q.speed) + 1));
          if (n > q.n) {
            q.n = n;
            sound.key(q.pan, q.level);
          }
          drawQ(q, t, shake);
        });
        if (t >= T.drop) {
          if (!fired.drop) {
            fired.drop = 1;
            sound.fall((T.impact - T.drop) / 1000);
          }
          drawBall(t);
        }
      } else {
        if (!fired.impact) {
          fired.impact = 1;
          explode();
          cx.clearRect(0, 0, W, H);
          intro.classList.add('is-boom');
          sound.boom();
        }
        if (t >= T.gather && !fired.gather) {
          fired.gather = 1;
          gatherStart();
          sound.gather((T.reveal - T.gather) / 1000);
        }
        if (t >= T.reveal - 450 && !fired.charge) {
          fired.charge = 1;
          sound.zap(0.4, 0.07);
        }
        drawParticles(t, f);
        drawFx(t, f);
        if (t >= T.reveal) {
          if (!fired.reveal) {
            fired.reveal = 1;
            sound.power();
          }
          while (lit < chars.length && t >= T.reveal + lit * 55) {
            chars[lit++].classList.add('is-lit');
            sound.zap(0.05, 0.04);
          }
        }
        if (t >= T.sub && !fired.sub) {
          fired.sub = 1;
          brand.classList.add('is-sub');
          sound.zap(0.2, 0.05);
        }
      }
      if (t >= T.end) {
        finish();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    var finish = function () {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      sound.stop();
      intro.classList.add('is-out');
      setTimeout(function () {
        root.classList.remove('g-intro-on', 'g-intro-lock');
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, 700);
    };
    var turnOnSound = function () {
      sound.enable().then(function (ok) {
        if (!ok) return;
        soundBtn.classList.add('is-on');
        if (t0) sound.tension((T.drop - (performance.now() - t0)) / 1000);
      });
    };
    var run = function () {
      // 캔버스에 그릴 글꼴을 먼저 받아 둠 (늦으면 0.8초 뒤 그냥 시작)
      var load = Promise.resolve();
      if (document.fonts && document.fonts.load) {
        var text = LAYOUT_PC.map(function (q) { return q[0]; }).join('');
        load = Promise.all([
          document.fonts.load('500 20px "Noto Sans KR"', text),
          document.fonts.load('800 40px "Noto Sans KR"', 'KGM 성수서비스센터')
        ]).catch(function () {});
      }
      Promise.race([load, wait(800)]).then(function () {
        if (ended) return;
        prepare();
        t0 = performance.now();
        sound.tension(T.drop / 1000);
        raf = requestAnimationFrame(frame);
      });
    };

    try { sessionStorage.setItem('kgmIntroSeen', '1'); } catch (e) {}
    root.classList.add('g-intro-lock');
    intro.querySelector('.g-introSkip').addEventListener('click', finish);
    soundBtn.addEventListener('click', function () {
      if (sound.isOn()) { sound.stop(); soundBtn.hidden = true; } else { turnOnSound(); }
    });
    // 버튼 외 아무 곳이나 누르거나, 스크롤하거나, 키를 누르면 바로 홈페이지로
    intro.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('button')) finish();
    });
    intro.addEventListener('wheel', finish, { passive: true });
    document.addEventListener('keydown', finish);

    var gate = /[?&]sound=1/.test(location.search) && intro.querySelector('.g-introStart');
    if (gate) {
      intro.style.animation = 'none';
      gate.hidden = false;
      gate.addEventListener('click', function () {
        gate.hidden = true;
        turnOnSound();
        run();
      });
    } else {
      turnOnSound();
      run();
    }
  }

  // 상단 공지 롤링 (3초)
  var items = document.querySelectorAll('.k-rollingList li');
  if (items.length > 1) {
    var current = 0;
    var paint = function () {
      var prev = (current - 1 + items.length) % items.length;
      items.forEach(function (li, i) {
        li.className = i === current ? 'k-isCurrent' : i === prev ? 'k-isPrev' : 'k-isNext';
        li.setAttribute('aria-hidden', i === current ? 'false' : 'true');
        var a = li.querySelector('a');
        if (a) a.tabIndex = i === current ? 0 : -1;
      });
    };
    setInterval(function () {
      current = (current + 1) % items.length;
      paint();
    }, 3000);
  }

  // 쇼룸 카드: 화면에 보일 때만 흐르게
  var marquee = document.querySelector('.s-marquee');
  if (marquee && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      marquee.setAttribute('data-running', entries[0].isIntersecting ? 'true' : 'false');
    }).observe(marquee);
  } else if (marquee) {
    marquee.setAttribute('data-running', 'true');
  }

  // 주소 복사
  var copyBtn = document.querySelector('.g-copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText('서울 성동구 아차산로11가길 37 KGM성수서비스센터').then(function () {
        copyBtn.textContent = '복사 완료';
        setTimeout(function () { copyBtn.textContent = '주소 복사'; }, 2000);
      });
    });
  }

  // 소모품 교환 가이드 팝업
  var guide = document.getElementById('maintenanceGuide');
  var guideBtn = document.querySelector('button.g-serviceCard');
  if (guide && guideBtn) {
    var close = function () { guide.hidden = true; };
    guideBtn.addEventListener('click', function () { guide.hidden = false; });
    guide.addEventListener('click', function (e) { if (e.target === guide) close(); });
    guide.querySelector('.g-guideClose').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
})();
