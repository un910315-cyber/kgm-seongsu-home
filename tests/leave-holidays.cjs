const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');
const L = require(path.join(root, 'un/leave-calculation.js'));

assert.equal(L.isHoliday('2026-10-05'), true, '개천절 대체공휴일');
assert.equal(L.isHoliday('2026-10-09'), true, '한글날');
assert.equal(L.isHoliday('2026-06-03'), true, '전국동시지방선거일');
assert.equal(L.isHoliday('2027-05-03'), true, '노동절 대체공휴일');
assert.equal(L.isHoliday('2027-12-27'), true, '기독탄신일 대체공휴일');
assert.equal(L.isHoliday('2026-10-06'), false);
assert.equal(L.isWeekend('2026-10-04'), true);

assert.deepEqual(
  L.businessDates('2026-10-02', '2026-10-06'),
  ['2026-10-02', '2026-10-06'],
  '주말과 개천절 대체공휴일 제외'
);
assert.deepEqual(
  L.businessDates('2026-09-24', '2026-09-28'),
  ['2026-09-28'],
  '추석 연휴와 주말 제외'
);
assert.deepEqual(
  L.businessDates('2026-10-06', '2026-10-08'),
  ['2026-10-06', '2026-10-07', '2026-10-08'],
  '일반 평일 3일 유지'
);

assert.equal(L.hours({type:'연차',date:'2026-10-05'}), 0, '공휴일 연차 미차감');
assert.equal(L.stats([
  {type:'연차',date:'2026-10-05'},
  {type:'연차',date:'2026-10-06'},
  {type:'오전반차',date:'2026-10-09'},
]).hours, 8, '공휴일 기록이 섞여도 근무일만 합산');
assert.equal(L.stats([
  {type:'연차',date:'2026-10-05'},
  {type:'연차',date:'2026-10-06'},
]).annual, 1, '공휴일은 연차 횟수에서도 제외');

assert.throws(
  () => L.businessDates('2028-01-03', '2028-01-05'),
  /2028년 공휴일 자료가 아직 등록되지 않았습니다/,
  '공휴일 자료 없는 연도는 오차 대신 차단'
);

console.log('PASS Korean holidays excluded from leave dates, hours and counts');
