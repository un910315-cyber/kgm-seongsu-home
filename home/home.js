// KGM 성수서비스센터 홈 동작: 첫 방문 인트로, 상단 공지 롤링, 쇼룸 화면 밖 정지, 주소 복사, 소모품 교환 가이드 팝업
(function () {
  // 첫 방문 인트로: 검색창 타이핑 → 금색 원 낙하 → 센터 이름 (세션당 1회, ?intro=1 로 강제 재생, &sound=1 은 소리 미리보기용 시작 버튼)
  var root = document.documentElement;
  var intro = document.getElementById('gIntro');
  if (intro && !root.classList.contains('g-intro-on')) {
    intro.parentNode.removeChild(intro);
  } else if (intro) {
    var query = intro.querySelector('.g-introQuery');
    var soundBtn = intro.querySelector('.g-introSound');
    var timers = [];
    var ended = false;
    var wait = function (ms) {
      return new Promise(function (resolve) { timers.push(setTimeout(resolve, ms)); });
    };

    // 인트로 사운드: 음원 파일 없이 Web Audio로 합성. 브라우저 정책상 화면을 한 번 눌러야 소리가 난다.
    var sound = (function () {
      var AC = window.AudioContext || window.webkitAudioContext;
      var ctx = null, out = null, verb = null, noise = null, on = false, beatTimer = null, nextNote = 0, step = 0;
      var BEAT = 0.25; // 8분음표 (120 BPM)
      var BASS = [98, 82.4, 130.8, 146.8]; // G2 E2 C3 D3
      var LEAD = [[587, 0, 494, 659, 0, 587, 440, 0], [587, 0, 494, 784, 0, 659, 587, 0],
        [523, 0, 659, 784, 0, 659, 523, 0], [587, 0, 740, 880, 0, 784, 880, 988]];
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
      var tone = function (t, f, type, peak, attack, decay, send) {
        var o = ctx.createOscillator(), g = env(t, peak, attack, decay);
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        o.connect(g);
        g.connect(out);
        if (send) g.connect(verb);
        o.start(t);
        o.stop(t + attack + decay + 0.05);
        return o;
      };
      var hiss = function (t, dur, type, f1, f2, peak) {
        var s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = env(t, peak, dur * 0.4, dur * 0.6);
        s.buffer = noise;
        fl.type = type;
        fl.frequency.setValueAtTime(f1, t);
        fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
        s.connect(fl);
        fl.connect(g);
        g.connect(out);
        s.start(t);
        s.stop(t + dur + 0.05);
      };
      var kick = function (t, peak) {
        var o = tone(t, 150, 'sine', peak || 0.9, 0.003, 0.32);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      };
      var hat = function (t) { hiss(t, 0.05, 'highpass', 8000, 9000, 0.12); };
      var snap = function (t) { hiss(t, 0.12, 'bandpass', 1800, 1200, 0.35); };
      var pluck = function (t, f) {
        tone(t, f, 'triangle', 0.16, 0.004, 0.28, true);
        tone(t, f * 2, 'sine', 0.05, 0.004, 0.15, true);
      };
      // 비트: 첫 마디는 하이햇·베이스로 궁금하게, 둘째 마디부터 킥·스냅·멜로디
      var schedule = function () {
        while (nextNote < ctx.currentTime + 0.12) {
          var bar = Math.floor(step / 8), i = step % 8, t = nextNote;
          if (i % 2 === 1 || bar > 0) hat(t);
          if (i === 0) tone(t, BASS[bar % 4], 'sine', 0.3, 0.01, 0.45);
          if (bar > 0) {
            if (i === 0 || i === 4) kick(t);
            if (i === 2 || i === 6) snap(t);
            var n = LEAD[bar % 4][i];
            if (n) pluck(t, n);
          }
          nextNote += BEAT;
          step++;
        }
      };
      return {
        isOn: function () { return on; },
        // 사용자 터치로 켬. 이미 지난 구간은 건너뛰고 지금부터 비트 시작
        enable: function () {
          if (on || !setup()) return Promise.resolve(false);
          return ctx.resume().then(function () {
            on = ctx.state === 'running';
            if (on && !ended && !intro.classList.contains('is-dot')) {
              tone(ctx.currentTime, 196, 'sawtooth', 0.04, 0.8, 1.6, true);
              hiss(ctx.currentTime, 1.4, 'bandpass', 300, 3000, 0.06);
              nextNote = ctx.currentTime + 0.05;
              step = 0;
              beatTimer = setInterval(schedule, 40);
            }
            return on;
          });
        },
        key: function () {
          if (on) hiss(ctx.currentTime, 0.025, 'highpass', 3500, 4000, 0.05);
        },
        question: function () {
          if (!on) return;
          var o = tone(ctx.currentTime, 784, 'sine', 0.12, 0.01, 0.35, true);
          o.frequency.exponentialRampToValueAtTime(1175, ctx.currentTime + 0.18);
        },
        // 공 낙하: 비트를 멈춰 긴장감 → 휙 → 튕길 때마다 한 음씩 올라가는 '퐁' (CSS g-introBounce 착지 시점과 맞춤)
        drop: function () {
          if (!on) return;
          clearInterval(beatTimer);
          var t = ctx.currentTime;
          hiss(t, 0.5, 'bandpass', 3500, 250, 0.16);
          [[0.51, 1047, 0.26, 1], [1.12, 1319, 0.2, 0.55], [1.5, 1568, 0.15, 0.3], [1.7, 2093, 0.1, 0]].forEach(function (b) {
            var at = t + b[0];
            var o = tone(at, b[1] * 1.5, 'sine', b[2], 0.002, 0.45, true);
            o.frequency.exponentialRampToValueAtTime(b[1], at + 0.05);
            tone(at, b[1] * 2.76, 'sine', b[2] * 0.2, 0.002, 0.15, true);
            if (b[3]) kick(at, b[3]);
          });
        },
        // 센터 이름 등장: 영화사 로고 같은 '디로디로롱' 사운드 로고 (자체 멜로디) + 따뜻한 화음
        reveal: function () {
          if (!on) return;
          var t = ctx.currentTime + 0.05;
          var bell = function (at, f, peak, decay) {
            tone(at, f, 'sine', peak, 0.004, decay, true);
            tone(at, f * 2.76, 'sine', peak * 0.25, 0.002, decay * 0.35, true);
            tone(at, f * 5.4, 'sine', peak * 0.08, 0.001, decay * 0.15, true);
          };
          // 디-로-디-로-롱: 높은음·낮은음을 오가다 한 단계 위에서 길게
          [[0, 1319, 0.5], [0.11, 1047, 0.5], [0.22, 1319, 0.5], [0.33, 1047, 0.5], [0.46, 1568, 2.4]].forEach(function (n) {
            bell(t + n[0], n[1], n[0] === 0.46 ? 0.2 : 0.14, n[2]);
          });
          // 마지막 음과 함께 열리는 화음 (C major 9) 과 저음
          [262, 330, 392, 494, 587].forEach(function (f) {
            var o = tone(t + 0.46, f, 'sawtooth', 0.025, 0.35, 2.2, true);
            o.detune.setValueAtTime(-6, t);
          });
          [523, 659, 784].forEach(function (f) { tone(t + 0.46, f, 'triangle', 0.05, 0.2, 2.3, true); });
          tone(t + 0.46, 65.4, 'sine', 0.4, 0.04, 2.4);
          hiss(t + 0.4, 2.2, 'highpass', 6000, 10000, 0.035);
        },
        stop: function () {
          clearInterval(beatTimer);
          if (!ctx) return;
          out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
          setTimeout(function () { ctx.close(); }, 1200);
        }
      };
    })();

    var type = function (text) {
      var i = 0;
      var next = function () {
        if (ended || i >= text.length) return Promise.resolve();
        query.textContent += text.charAt(i++);
        sound.key();
        if (i === text.length && text.charAt(i - 1) === '?') sound.question();
        return wait(65).then(next);
      };
      return next();
    };
    var erase = function () {
      var next = function () {
        if (ended || !query.textContent) return Promise.resolve();
        query.textContent = query.textContent.slice(0, -1);
        return wait(22).then(next);
      };
      return next();
    };
    var finish = function () {
      if (ended) return;
      ended = true;
      timers.forEach(clearTimeout);
      sound.stop();
      intro.classList.add('is-out');
      setTimeout(function () {
        root.classList.remove('g-intro-on', 'g-intro-lock');
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, 700);
    };
    var turnOnSound = function () {
      sound.enable().then(function (ok) {
        if (ok) soundBtn.classList.add('is-on');
      });
    };
    var run = function () {
      wait(300)
        .then(function () { intro.classList.add('is-search'); return wait(500); })
        .then(function () { return type('사고가 났는데 어디로 가야 할까?'); })
        .then(function () { return wait(800); })
        .then(erase)
        .then(function () { return wait(200); })
        .then(function () { return type('사고수리는 어디서 하지?'); })
        .then(function () { return wait(900); })
        .then(function () { if (!ended) { intro.classList.add('is-dot'); sound.drop(); } return wait(1900); })
        .then(function () { if (!ended) { intro.classList.add('is-brand'); sound.reveal(); } return wait(2600); })
        .then(finish);
    };

    try { sessionStorage.setItem('kgmIntroSeen', '1'); } catch (e) {}
    root.classList.add('g-intro-lock');
    intro.querySelector('.g-introSkip').addEventListener('click', finish);
    soundBtn.addEventListener('click', function () {
      if (sound.isOn()) { sound.stop(); soundBtn.hidden = true; } else { turnOnSound(); }
    });
    intro.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('button')) turnOnSound();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') finish(); });

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
