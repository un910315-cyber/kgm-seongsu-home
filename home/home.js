// KGM 성수서비스센터 홈 동작: 상단 공지 롤링, 쇼룸 화면 밖 정지, 주소 복사, 소모품 교환 가이드 팝업
(function () {
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
