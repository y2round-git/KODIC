/**
 * hangul.js
 * 대한민국 국어사전(표준국어대사전) 공식 배열 순서 엔진 + 4단계 찾기 알고리즘 + 활용형 기본형 추정기
 * 초성(19) → 중성(21) → 종성(28) 공식 순서 엄수
 */
(function (global) {
  'use strict';

  // 국어사전 자음(첫소리) 공식 순서 19개
  const CHOSEONG = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
    'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];

  const DOUBLE_CHOSEONG = new Set(['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ']);

  // 국어사전 모음(가운뎃소리) 공식 순서 21개
  const JUNGSEONG = [
    'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ',
    'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ',
    'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ',
    'ㅡ', 'ㅢ', 'ㅣ'
  ];

  // 국어사전 받침(끝소리) 공식 순서 28개 (0번 = 받침 없음)
  const JONGSEONG = [
    '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ',
    'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ',
    'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];

  const SUPERSCRIPTS = ['', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  const HANGUL_START = 0xAC00;
  const HANGUL_END = 0xD7A3;

  function isHangulSyllable(ch) {
    if (!ch) return false;
    const code = ch.charCodeAt(0);
    return code >= HANGUL_START && code <= HANGUL_END;
  }

  function isChoseongJamo(ch) {
    return CHOSEONG.indexOf(ch) !== -1;
  }

  function decomposeChar(ch) {
    if (!isHangulSyllable(ch)) {
      return {
        char: ch,
        isHangul: false,
        choIndex: -1,
        jungIndex: -1,
        jongIndex: -1,
        cho: '',
        jung: '',
        jong: ''
      };
    }
    const offset = ch.charCodeAt(0) - HANGUL_START;
    const choIndex = Math.floor(offset / (21 * 28));
    const jungIndex = Math.floor((offset % (21 * 28)) / 28);
    const jongIndex = offset % 28;
    return {
      char: ch,
      isHangul: true,
      choIndex,
      jungIndex,
      jongIndex,
      cho: CHOSEONG[choIndex],
      jung: JUNGSEONG[jungIndex],
      jong: JONGSEONG[jongIndex]
    };
  }

  function composeChar(choIndex, jungIndex, jongIndex) {
    const jg = jongIndex || 0;
    if (
      choIndex < 0 || choIndex >= CHOSEONG.length ||
      jungIndex < 0 || jungIndex >= JUNGSEONG.length ||
      jg < 0 || jg >= JONGSEONG.length
    ) {
      return '';
    }
    return String.fromCharCode(HANGUL_START + (choIndex * 21 * 28) + (jungIndex * 28) + jg);
  }

  function normalizeForSort(word) {
    return (word || '').replace(/[^가-힣]/g, '');
  }

  function decomposeWord(word) {
    const clean = normalizeForSort(word);
    const result = [];
    for (let i = 0; i < clean.length; i++) {
      result.push(decomposeChar(clean[i]));
    }
    return result;
  }

  function getChoseongString(word) {
    const clean = normalizeForSort(word);
    let out = '';
    for (let i = 0; i < clean.length; i++) {
      const d = decomposeChar(clean[i]);
      if (d.isHangul) out += d.cho;
    }
    return out;
  }

  function isChoseongQuery(str) {
    const trimmed = (str || '').replace(/\s+/g, '');
    if (!trimmed) return false;
    for (let i = 0; i < trimmed.length; i++) {
      if (!isChoseongJamo(trimmed[i])) return false;
    }
    return true;
  }

  /**
   * 대한민국 국어사전 공식 순서 비교: 초성(19) → 중성(21) → 종성(28) → 글자 수
   */
  function compareKoreanStrings(wordA, wordB) {
    const aChars = decomposeWord(wordA);
    const bChars = decomposeWord(wordB);
    const minLen = Math.min(aChars.length, bChars.length);

    for (let i = 0; i < minLen; i++) {
      const a = aChars[i];
      const b = bChars[i];
      if (a.choIndex !== b.choIndex) return a.choIndex - b.choIndex;
      if (a.jungIndex !== b.jungIndex) return a.jungIndex - b.jungIndex;
      if (a.jongIndex !== b.jongIndex) return a.jongIndex - b.jongIndex;
    }

    if (aChars.length !== bChars.length) {
      return aChars.length - bChars.length;
    }
    return (wordA || '').localeCompare(wordB || '', 'ko');
  }

  function compareKoreanEntries(entryA, entryB) {
    const cmp = compareKoreanStrings(entryA.word, entryB.word);
    if (cmp !== 0) return cmp;
    return (entryA.homonym || 0) - (entryB.homonym || 0);
  }

  function toSuperscript(num) {
    if (!num) return '';
    return String(num)
      .split('')
      .map(function (d) { return SUPERSCRIPTS[parseInt(d, 10)] || d; })
      .join('');
  }

  function formatHeadword(entry) {
    return entry.word + toSuperscript(entry.homonym);
  }

  function getOrdinalKorean(index) {
    const names = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'];
    return names[index] || (index + 1) + '번째';
  }

  /**
   * 두 낱말이 국어사전에서 어떤 순서로 나오는지 3학년 눈높이로 해설
   */
  function explainOrder(wordA, wordB) {
    const cleanA = normalizeForSort(wordA);
    const cleanB = normalizeForSort(wordB);
    if (!cleanA || !cleanB) {
      return { valid: false, message: '한글 낱말을 입력해 주세요.' };
    }

    const aChars = decomposeWord(cleanA);
    const bChars = decomposeWord(cleanB);
    const minLen = Math.min(aChars.length, bChars.length);

    for (let i = 0; i < minLen; i++) {
      const a = aChars[i];
      const b = bChars[i];
      const posLabel = getOrdinalKorean(i);

      if (a.choIndex !== b.choIndex) {
        const first = a.choIndex < b.choIndex ? a : b;
        const second = a.choIndex < b.choIndex ? b : a;
        return {
          valid: true,
          order: a.choIndex < b.choIndex ? -1 : 1,
          diffIndex: i,
          diffType: 'choseong',
          summary: `${posLabel} 글자 '${first.char}'와 '${second.char}'의 첫소리 자음을 비교하면 '${first.cho}'이(가) '${second.cho}'보다 먼저 나와요.`
        };
      }
      if (a.jungIndex !== b.jungIndex) {
        const first = a.jungIndex < b.jungIndex ? a : b;
        const second = a.jungIndex < b.jungIndex ? b : a;
        return {
          valid: true,
          order: a.jungIndex < b.jungIndex ? -1 : 1,
          diffIndex: i,
          diffType: 'jungseong',
          summary: `${posLabel} 글자 '${first.char}'와 '${second.char}'는 첫소리 '${first.cho}'이 같고, 모음 '${first.jung}'이(가) '${second.jung}'보다 먼저 나와요.`
        };
      }
      if (a.jongIndex !== b.jongIndex) {
        const first = a.jongIndex < b.jongIndex ? a : b;
        const second = a.jongIndex < b.jongIndex ? b : a;
        const firstJong = first.jong ? `받침 '${first.jong}'이(가)` : '받침이 없는 글자가';
        const secondJong = second.jong ? `받침 '${second.jong}'` : '받침이 없는 글자';
        return {
          valid: true,
          order: a.jongIndex < b.jongIndex ? -1 : 1,
          diffIndex: i,
          diffType: 'jongseong',
          summary: `${posLabel} 글자 '${first.char}'와 '${second.char}'는 '${first.cho}+${first.jung}'이 같고, ${firstJong} ${secondJong}보다 먼저 나와요.`
        };
      }
    }

    if (aChars.length !== bChars.length) {
      const firstWord = aChars.length < bChars.length ? wordA : wordB;
      const secondWord = aChars.length < bChars.length ? wordB : wordA;
      return {
        valid: true,
        order: aChars.length < bChars.length ? -1 : 1,
        diffIndex: minLen,
        diffType: 'length',
        summary: `앞의 ${minLen}글자가 같으므로 짧은 낱말 '${firstWord}'이(가) '${secondWord}'보다 먼저 나와요.`
      };
    }

    return {
      valid: true,
      order: 0,
      diffIndex: -1,
      diffType: 'same',
      summary: `한글 모양이 똑같은 동음이의어이므로 어깨번호(¹ → ² → ³) 순서로 나와요.`
    };
  }

  /**
   * 한국어 활용형(예: 감았다, 감고, 걸었어요, 추워요, 예쁜, 빨간, 행복해)으로부터
   * 국어사전 기본형('-다') 후보 목록을 자동 생성
   */
  function guessBaseForms(rawQuery) {
    const q = normalizeForSort(rawQuery);
    if (!q || q.length < 2) return [];

    const candidates = new Set();

    function add(stem) {
      if (stem && stem.length >= 1) {
        candidates.add(stem + '다');
      }
    }

    // 1. 흔한 활용 어미 목록 (긴 어미부터 검사)
    const endings = [
      '했습니다', '했어요', '했었다', '했다', '해서', '해요', '하고', '하는', '하니', '하면', '하게', '하지', '해야', '할게', '할까', '해', '한', '할',
      '았습니다', '었습니다', '였습니다',
      '았어요', '었어요', '였어요',
      '았었다', '었었다',
      '았어', '었어', '였어',
      '았다', '었다', '였다',
      '아서', '어서', '여서',
      '아요', '어요', '여요',
      '으면', '으니', '으나', '으며', '으러', '으로', '으세요', '으신',
      '습니다', 'ㅂ니다', '세요', '셔요', '셨다', '셨어',
      '는데', '는지', '는다', '는다', '는구나', '는',
      '고', '게', '기', '지', '자', '며', '면', '니', '나', '네', '라', '아', '어', '여', '은', '을', '음'
    ];

    // 1-a. '하다' 계열 특수 처리 (행복해 -> 행복하다, 깨끗한 -> 깨끗하다)
    if (/(해|했|한|할|하)/.test(q)) {
      ['했습니다', '했어요', '했다', '해서', '해요', '해', '한', '할', '하고', '하는', '하게', '하니', '하면'].forEach(function (suf) {
        if (q.length > suf.length && q.endsWith(suf)) {
          candidates.add(q.slice(0, -suf.length) + '하다');
        }
      });
    }

    // 1-b. 일반 규칙 어미 제거
    endings.forEach(function (suf) {
      if (q.length > suf.length && q.endsWith(suf)) {
        const stem = q.slice(0, -suf.length);
        add(stem);

        // ㄷ 불규칙: 들었 -> 듣다, 걸어 -> 걷다, 물어 -> 묻다
        const last = decomposeChar(stem[stem.length - 1]);
        if (last.isHangul && last.jong === 'ㄹ') {
          const dChar = composeChar(last.choIndex, last.jungIndex, JONGSEONG.indexOf('ㄷ'));
          add(stem.slice(0, -1) + dChar);
        }
        // ㅅ 불규칙: 그어 -> 긋다, 지어 -> 짓다, 나아 -> 낫다
        if (last.isHangul && last.jong === '') {
          const sChar = composeChar(last.choIndex, last.jungIndex, JONGSEONG.indexOf('ㅅ'));
          add(stem.slice(0, -1) + sChar);
        }
      }
    });

    // 2. ㅂ 불규칙: 고마워/고마운/고마웠다 -> 고맙다, 추워/추운 -> 춥다, 도와/도운 -> 돕다, 어려워 -> 어렵다
    const bEndings = ['웠습니다', '웠어요', '웠다', '웠어', '워서', '워요', '워', '왔어요', '왔다', '와서', '와요', '와', '우니', '우면', '운', '울'];
    bEndings.forEach(function (suf) {
      if (q.length > suf.length && q.endsWith(suf)) {
        const prefix = q.slice(0, -suf.length);
        const last = decomposeChar(prefix[prefix.length - 1]);
        if (last.isHangul && last.jong === '') {
          const bChar = composeChar(last.choIndex, last.jungIndex, JONGSEONG.indexOf('ㅂ'));
          add(prefix.slice(0, -1) + bChar);
        }
      }
    });

    // 3. 'ㄴ/ㄹ/ㅆ' 받침이 바로 붙은 축약형 (예쁜 -> 예쁘다, 큰 -> 크다, 빨간 -> 빨갛다, 갔다 -> 가다, 봤다 -> 보다, 줬다 -> 주다, 떴다 -> 뜨다, 썼다 -> 쓰다)
    const lastCh = decomposeChar(q[q.length - 1]);
    const prevPart = q.slice(0, -1);

    // 마지막 글자가 았/었/였 없이 축약된 관형형(ㄴ/ㄹ) 예: 예쁜, 큰, 빨간, 파란, 하얀, 노란, 긴, 먼, 단, 짠, 쓴, 본, 온, 간, 준
    if (lastCh.isHangul && (lastCh.jong === 'ㄴ' || lastCh.jong === 'ㄹ')) {
      const noJong = composeChar(lastCh.choIndex, lastCh.jungIndex, 0);
      add(prevPart + noJong); // 예쁜 -> 예쁘다, 큰 -> 크다, 간 -> 가다
      const hJong = composeChar(lastCh.choIndex, lastCh.jungIndex, JONGSEONG.indexOf('ㅎ'));
      add(prevPart + hJong); // 빨간 -> 빨갛다, 파란 -> 파랗다, 하얀 -> 하얗다, 노란 -> 노랗다
      const rJong = composeChar(lastCh.choIndex, lastCh.jungIndex, JONGSEONG.indexOf('ㄹ'));
      add(prevPart + rJong); // 긴 -> 길다, 먼 -> 멀다, 단 -> 달다, 아는 -> 알다
    }

    // 마지막에서 두 번째 글자에 ㅆ 받침 (갔다, 섰다, 컸다, 썼다, 떴다, 봤다, 왔다, 줬다, 폈다, 예뻤다, 기뻤다, 슬펐다, 빨갰다)
    const pastTails = ['다', '어', '어요', '습니다', '지', '고', '네'];
    pastTails.forEach(function (tail) {
      if (q.length > tail.length && q.endsWith(tail)) {
        const body = q.slice(0, -tail.length);
        const bLast = decomposeChar(body[body.length - 1]);
        const bPrev = body.slice(0, -1);
        if (bLast.isHangul && bLast.jong === 'ㅆ') {
          // 갔다 -> 가다, 섰다 -> 서다
          add(bPrev + composeChar(bLast.choIndex, bLast.jungIndex, 0));
          // 컸다/썼다/예뻤다/기뻤다/슬펐다 (ㅓ -> ㅡ 복원)
          if (bLast.jung === 'ㅓ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅡ'), 0));
          }
          // 봤다/왔다 (ㅘ -> ㅗ)
          if (bLast.jung === 'ㅘ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅗ'), 0));
          }
          // 줬다/배웠다 (ㅝ -> ㅜ)
          if (bLast.jung === 'ㅝ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅜ'), 0));
          }
          // 폈다/느꼈다/달렸다/그렸다/마셨다 (ㅕ -> ㅣ)
          if (bLast.jung === 'ㅕ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅣ'), 0));
          }
          // 빨갰다/파랬다 (ㅐ -> ㅏ+ㅎ)
          if (bLast.jung === 'ㅐ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅏ'), JONGSEONG.indexOf('ㅎ')));
          }
          // 르 불규칙: 달랐다/빨랐다/몰랐다/불렀다 (ㄹ + 라/러)
          if (bPrev.length >= 1 && (bLast.char === '랐' || bLast.char === '렀')) {
            const pLast = decomposeChar(bPrev[bPrev.length - 1]);
            if (pLast.isHangul && pLast.jong === 'ㄹ') {
              add(bPrev.slice(0, -1) + composeChar(pLast.choIndex, pLast.jungIndex, 0) + '르');
            }
          }
        }
      }
    });

    // 현재/연결 축약형 (예뻐/예뻐서, 커/커요, 써/써서, 봐/봐요, 줘/줘요, 달려/그려, 빨개/파래, 몰라/빨라/달라/불러)
    const softTails = ['', '요', '서', '도', '야'];
    softTails.forEach(function (tail) {
      if (q.length > tail.length && q.endsWith(tail)) {
        const body = tail ? q.slice(0, -tail.length) : q;
        if (!body) return;
        const bLast = decomposeChar(body[body.length - 1]);
        const bPrev = body.slice(0, -1);
        if (bLast.isHangul && bLast.jong === '') {
          if (bLast.jung === 'ㅓ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅡ'), 0));
          }
          if (bLast.jung === 'ㅘ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅗ'), 0));
          }
          if (bLast.jung === 'ㅝ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅜ'), 0));
          }
          if (bLast.jung === 'ㅕ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅣ'), 0));
          }
          if (bLast.jung === 'ㅐ') {
            add(bPrev + composeChar(bLast.choIndex, JUNGSEONG.indexOf('ㅏ'), JONGSEONG.indexOf('ㅎ')));
          }
          if (bPrev.length >= 1 && (bLast.char === '라' || bLast.char === '러')) {
            const pLast = decomposeChar(bPrev[bPrev.length - 1]);
            if (pLast.isHangul && pLast.jong === 'ㄹ') {
              add(bPrev.slice(0, -1) + composeChar(pLast.choIndex, pLast.jungIndex, 0) + '르');
            }
          }
        }
      }
    });

    candidates.delete(q);
    return Array.from(candidates);
  }

  /**
   * 낱말을 국어사전에서 찾는 4단계 알고리즘 데이터 생성
   */
  function getLookupSteps(word) {
    const clean = normalizeForSort(word);
    if (!clean) return null;
    const chars = decomposeWord(clean);
    const first = chars[0];
    if (!first || !first.isHangul) return null;

    const step2Syllable = composeChar(first.choIndex, first.jungIndex, 0);
    const step3Syllable = first.char;
    const second = chars.length > 1 ? chars[1] : null;

    return {
      word: word,
      clean: clean,
      first: first,
      second: second,
      step1: {
        title: '단계 1 · 첫 글자의 자음(첫소리)',
        choIndex: first.choIndex,
        cho: first.cho,
        orderNum: first.choIndex + 1,
        desc: `'${first.char}'의 첫소리 자음 '${first.cho}' (${first.choIndex + 1}번째 자음) 부분을 펼쳐요.`
      },
      step2: {
        title: '단계 2 · 첫 글자의 모음(가운뎃소리)',
        jungIndex: first.jungIndex,
        jung: first.jung,
        syllable: step2Syllable,
        orderNum: first.jungIndex + 1,
        desc: `'${first.cho}' 안에서 모음 '${first.jung}' (${first.jungIndex + 1}번째 모음) → '${step2Syllable}' 자리를 찾아요.`
      },
      step3: {
        title: '단계 3 · 첫 글자의 받침(끝소리)',
        jongIndex: first.jongIndex,
        jong: first.jong,
        syllable: step3Syllable,
        orderNum: first.jongIndex + 1,
        desc: first.jong
          ? `'${step2Syllable}'에서 받침 '${first.jong}' (${first.jongIndex + 1}번째 순서) → '${step3Syllable}' 자리를 찾아요.`
          : `'${step3Syllable}'은 받침이 없으므로 '${step2Syllable}' 중에서 가장 먼저 나오는 자리예요.`
      },
      step4: {
        title: '단계 4 · 둘째 글자 순서로 낱말 찾기',
        desc: second
          ? `'${first.char}'으로 시작하는 낱말들 속에서 둘째 글자 '${second.char}'(${second.cho}+${second.jung}${second.jong ? '+' + second.jong : ''}) 순서로 '${word}'을(를) 찾아요.`
          : `'${first.char}' 한 글자 낱말은 '${first.char}'으로 시작하는 낱말 가운데 가장 먼저 나와요.`
      }
    };
  }

  global.HangulEngine = {
    CHOSEONG,
    DOUBLE_CHOSEONG,
    JUNGSEONG,
    JONGSEONG,
    isHangulSyllable,
    isChoseongJamo,
    decomposeChar,
    composeChar,
    normalizeForSort,
    decomposeWord,
    getChoseongString,
    isChoseongQuery,
    compareKoreanStrings,
    compareKoreanEntries,
    explainOrder,
    guessBaseForms,
    getLookupSteps,
    toSuperscript,
    formatHeadword
  };
})(window);
