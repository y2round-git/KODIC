/**
 * app.js
 * 초등 3학년 국어사전 - 단순화된 인터넷 국어사전 + 4단계 찾기 알고리즘 지도 컨트롤러
 */
(function () {
  'use strict';

  const H = window.HangulEngine;
  const DATA = window.DictionaryData;

  const state = {
    allEntries: [],
    filteredEntries: [],
    selectedEntryId: null,

    // 4단계 찾기 상태
    selectedCho: null,   // 0..18
    selectedJung: null,  // 0..20
    selectedJong: null,  // 0..27
    activeStep: 1,       // 1 | 2 | 3 | 4

    // 검색 상태
    searchQuery: '',
    baseformNotice: null, // { original, baseWord }
    unlistedWord: null,   // 사전에 없는 한글 낱말 검색 시 단계별 안내용

    // 시범 애니메이션 타이머
    demoTimerIds: [],
    demoHighlightStep: 0 // 0 = 없음, 1..4 = 현재 강조 중인 시범 단계
  };

  const el = {};

  function cacheDom() {
    el.brandHome = document.getElementById('brandHome');
    el.searchInput = document.getElementById('searchInput');
    el.clearSearchBtn = document.getElementById('clearSearchBtn');
    el.searchBtn = document.getElementById('searchBtn');
    el.autocompleteList = document.getElementById('autocompleteList');
    el.quickBar = document.getElementById('quickBar');

    el.toggleChartBtn = document.getElementById('toggleChartBtn');
    el.orderChartDrawer = document.getElementById('orderChartDrawer');
    el.closeChartBtn = document.getElementById('closeChartBtn');
    el.refChoList = document.getElementById('refChoList');
    el.refJungList = document.getElementById('refJungList');
    el.refJongList = document.getElementById('refJongList');

    el.algoGuideSentence = document.getElementById('algoGuideSentence');
    el.replayStepsBtn = document.getElementById('replayStepsBtn');
    el.resetStepsBtn = document.getElementById('resetStepsBtn');
    el.baseformNotice = document.getElementById('baseformNotice');

    el.stepCards = [
      null,
      document.getElementById('stepCard1'),
      document.getElementById('stepCard2'),
      document.getElementById('stepCard3'),
      document.getElementById('stepCard4')
    ];
    el.stepVals = [
      null,
      document.getElementById('stepVal1'),
      document.getElementById('stepVal2'),
      document.getElementById('stepVal3'),
      document.getElementById('stepVal4')
    ];

    el.selectorBox1 = document.getElementById('selectorBox1');
    el.selectorBox2 = document.getElementById('selectorBox2');
    el.selectorBox3 = document.getElementById('selectorBox3');
    el.step2Heading = document.getElementById('step2Heading');
    el.step3Heading = document.getElementById('step3Heading');

    el.choseongBar = document.getElementById('choseongBar');
    el.jungseongBar = document.getElementById('jungseongBar');
    el.jongseongBar = document.getElementById('jongseongBar');

    el.wordListPanel = document.getElementById('wordListPanel');
    el.listFilterTitle = document.getElementById('listFilterTitle');
    el.listCountText = document.getElementById('listCountText');
    el.listOrderHint = document.getElementById('listOrderHint');
    el.wordList = document.getElementById('wordList');
    el.entryDetailPanel = document.getElementById('entryDetailPanel');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getFirstCharInfo(entry) {
    const clean = H.normalizeForSort(entry.word);
    return clean ? H.decomposeChar(clean[0]) : null;
  }

  function getSelectedEntry() {
    if (!state.selectedEntryId) return null;
    return state.allEntries.find(function (e) { return e.id === state.selectedEntryId; }) || null;
  }

  function clearDemoTimers() {
    state.demoTimerIds.forEach(function (id) { clearTimeout(id); });
    state.demoTimerIds = [];
    state.demoHighlightStep = 0;
  }

  // ==================== 상단 접이식 자음·모음·받침 공식 순서표 ====================
  function renderReferenceChart() {
    el.refChoList.innerHTML = H.CHOSEONG.map(function (c, i) {
      const dbl = H.DOUBLE_CHOSEONG.has(c) ? 'double' : '';
      return `<span class="ref-cell ${dbl}" title="${i + 1}번째 자음">${c}</span>`;
    }).join('');

    el.refJungList.innerHTML = H.JUNGSEONG.map(function (v, i) {
      return `<span class="ref-cell" title="${i + 1}번째 모음">${v}</span>`;
    }).join('');

    el.refJongList.innerHTML = H.JONGSEONG.map(function (j, i) {
      const label = i === 0 ? '없음' : j;
      return `<span class="ref-cell" title="${i + 1}번째 받침 순서">${label}</span>`;
    }).join('');
  }

  // ==================== 4단계 진행 카드 & 단계별 선택 박스 렌더링 ====================
  function renderStepperAndSelectors() {
    const selectedEntry = getSelectedEntry();
    const targetWord = selectedEntry ? selectedEntry.word : state.unlistedWord;

    // 단계별 값 텍스트 계산
    const choDone = state.selectedCho !== null;
    const jungDone = choDone && state.selectedJung !== null;
    const jongDone = jungDone && state.selectedJong !== null;
    const wordDone = Boolean(selectedEntry);

    // 단계 1 값
    el.stepVals[1].textContent = choDone
      ? `${H.CHOSEONG[state.selectedCho]} (${state.selectedCho + 1}번째)`
      : '자음 고르기';

    // 단계 2 값
    if (jungDone) {
      const syl2 = H.composeChar(state.selectedCho, state.selectedJung, 0);
      el.stepVals[2].textContent = `${H.JUNGSEONG[state.selectedJung]} → ${syl2}`;
    } else if (choDone) {
      el.stepVals[2].textContent = '모음 고르기';
    } else {
      el.stepVals[2].textContent = '대기 중';
    }

    // 단계 3 값
    if (jongDone) {
      const syl3 = H.composeChar(state.selectedCho, state.selectedJung, state.selectedJong);
      const jLabel = state.selectedJong === 0 ? '없음' : H.JONGSEONG[state.selectedJong];
      el.stepVals[3].textContent = `${jLabel} → ${syl3}`;
    } else if (jungDone) {
      el.stepVals[3].textContent = '받침 고르기';
    } else {
      el.stepVals[3].textContent = '대기 중';
    }

    // 단계 4 값
    if (state.demoHighlightStep >= 1 && state.demoHighlightStep <= 3) {
      el.stepVals[4].textContent = '찾는 중…';
    } else if (selectedEntry) {
      el.stepVals[4].textContent = H.formatHeadword(selectedEntry);
    } else if (state.unlistedWord) {
      el.stepVals[4].textContent = `${state.unlistedWord} (위치 안내)`;
    } else if (jongDone) {
      el.stepVals[4].textContent = '목록에서 고르기';
    } else {
      el.stepVals[4].textContent = '대기 중';
    }

    // Step Card 상태 클래스 업데이트
    const doneFlags = [false, choDone, jungDone, jongDone, wordDone];
    const enabledFlags = [false, true, choDone, jungDone, choDone];

    for (let s = 1; s <= 4; s++) {
      const card = el.stepCards[s];
      card.disabled = !enabledFlags[s];
      card.classList.remove('is-active', 'is-done', 'is-demo-focus');

      if (state.demoHighlightStep === s) {
        card.classList.add('is-demo-focus');
      } else if (state.activeStep === s) {
        card.classList.add('is-active');
      } else if (doneFlags[s]) {
        card.classList.add('is-done');
      }
    }

    // 안내 문장 업데이트
    if (state.demoHighlightStep > 0 && targetWord) {
      const steps = H.getLookupSteps(targetWord);
      if (steps) {
        const msgMap = {
          1: `▶ [단계 1] ${steps.step1.desc}`,
          2: `▶ [단계 2] ${steps.step2.desc}`,
          3: `▶ [단계 3] ${steps.step3.desc}`,
          4: `▶ [단계 4] ${steps.step4.desc}`
        };
        el.algoGuideSentence.textContent = msgMap[state.demoHighlightStep] || '';
      }
    } else if (state.activeStep === 1) {
      el.algoGuideSentence.textContent = '👉 단계 1: 찾으려는 낱말 첫 글자의 자음(ㄱ~ㅎ)을 눌러 보세요.';
    } else if (state.activeStep === 2) {
      el.algoGuideSentence.textContent = `👉 단계 2: '${H.CHOSEONG[state.selectedCho]}'에 붙는 모음(ㅏ~ㅣ)을 눌러 보세요.`;
    } else if (state.activeStep === 3) {
      const syl2 = H.composeChar(state.selectedCho, state.selectedJung, 0);
      el.algoGuideSentence.textContent = `👉 단계 3: '${syl2}'의 받침(없음 → ㄱ → … → ㅎ)을 눌러 보세요.`;
    } else {
      if (jongDone) {
        const syl3 = H.composeChar(state.selectedCho, state.selectedJung, state.selectedJong);
        el.algoGuideSentence.textContent = `👉 단계 4: '${syl3}'으로 시작하는 낱말 가운데 둘째 글자 순서로 골라 보세요!`;
      } else {
        el.algoGuideSentence.textContent = '👉 단계 4: 아래 목록에서 낱말을 눌러 뜻을 확인해 보세요.';
      }
    }

    // '▶ 단계별 찾기 시범' 버튼 표시 여부
    el.replayStepsBtn.classList.toggle('hidden', !targetWord);

    // 기본형 안내 배너
    if (state.baseformNotice) {
      el.baseformNotice.innerHTML = `
        💡 <strong>[준비 단계 · 기본형 바꾸기]</strong>
        "<strong>${escapeHtml(state.baseformNotice.original)}</strong>"은(는) 문장 속에서 모양이 바뀐 낱말이에요!
        국어사전에서는 기본형 "<strong>${escapeHtml(state.baseformNotice.baseWord)}</strong>"(으)로 바꾸어 <strong>단계 1 → 2 → 3 → 4</strong> 순서로 찾아요.
      `;
      el.baseformNotice.classList.remove('hidden');
    } else {
      el.baseformNotice.classList.add('hidden');
    }

    // 단계별 선택 박스 표시/강조
    // 단계 1은 항상 표시
    el.selectorBox1.classList.toggle('is-current', state.activeStep === 1 || state.demoHighlightStep === 1);
    renderChoseongButtons();

    // 단계 2는 자음이 선택되면 표시
    if (choDone) {
      el.selectorBox2.classList.remove('hidden');
      el.selectorBox2.classList.toggle('is-current', state.activeStep === 2 || state.demoHighlightStep === 2);
      el.step2Heading.textContent = `'${H.CHOSEONG[state.selectedCho]}'에 붙는 모음(가운뎃소리) 21자 순서`;
      renderJungseongButtons();
    } else {
      el.selectorBox2.classList.add('hidden');
    }

    // 단계 3은 모음까지 선택되면 표시
    if (jungDone) {
      el.selectorBox3.classList.remove('hidden');
      el.selectorBox3.classList.toggle('is-current', state.activeStep === 3 || state.demoHighlightStep === 3);
      const syl2 = H.composeChar(state.selectedCho, state.selectedJung, 0);
      el.step3Heading.textContent = `'${syl2}'의 받침(끝소리) 공식 순서`;
      renderJongseongButtons();
    } else {
      el.selectorBox3.classList.add('hidden');
    }

    // 단계 4 왼쪽 낱말 목록 강조
    el.wordListPanel.classList.toggle('is-step4-focus', state.activeStep === 4 || state.demoHighlightStep === 4);
  }

  function renderChoseongButtons() {
    const counts = new Array(H.CHOSEONG.length).fill(0);
    state.allEntries.forEach(function (entry) {
      const f = getFirstCharInfo(entry);
      if (f && f.isHangul) counts[f.choIndex]++;
    });

    el.choseongBar.innerHTML = H.CHOSEONG.map(function (cho, idx) {
      const cnt = counts[idx];
      const active = state.selectedCho === idx ? 'active' : '';
      const dbl = H.DOUBLE_CHOSEONG.has(cho) ? 'is-double' : '';
      const empty = cnt === 0 ? 'empty-jamo' : '';
      return `<button type="button" class="jamo-btn ${active} ${dbl} ${empty}" data-cho="${idx}" title="${idx + 1}번째 자음 ${cho}">
        <span>${cho}</span>
        <span class="jamo-sub">${cnt}</span>
      </button>`;
    }).join('');
  }

  function renderJungseongButtons() {
    const counts = new Array(H.JUNGSEONG.length).fill(0);
    state.allEntries.forEach(function (entry) {
      const f = getFirstCharInfo(entry);
      if (f && f.isHangul && f.choIndex === state.selectedCho) {
        counts[f.jungIndex]++;
      }
    });

    el.jungseongBar.innerHTML = H.JUNGSEONG.map(function (jung, idx) {
      const cnt = counts[idx];
      const active = state.selectedJung === idx ? 'active' : '';
      const empty = cnt === 0 ? 'empty-jamo' : '';
      const syl = H.composeChar(state.selectedCho, idx, 0);
      return `<button type="button" class="jamo-btn ${active} ${empty}" data-jung="${idx}" title="${idx + 1}번째 모음 ${jung} (${syl})">
        <span>${jung}</span>
        <span class="jamo-sub">${syl}(${cnt})</span>
      </button>`;
    }).join('');
  }

  function renderJongseongButtons() {
    const counts = new Array(H.JONGSEONG.length).fill(0);
    state.allEntries.forEach(function (entry) {
      const f = getFirstCharInfo(entry);
      if (f && f.isHangul && f.choIndex === state.selectedCho && f.jungIndex === state.selectedJung) {
        counts[f.jongIndex]++;
      }
    });

    let html = '';
    H.JONGSEONG.forEach(function (jong, idx) {
      // '받침 없음(0)'과 실제 존재하는 받침, 또는 현재 선택된 받침을 공식 순서대로 표시
      if (idx !== 0 && counts[idx] === 0 && state.selectedJong !== idx) return;
      const active = state.selectedJong === idx ? 'active' : '';
      const empty = counts[idx] === 0 ? 'empty-jamo' : '';
      const syl = H.composeChar(state.selectedCho, state.selectedJung, idx);
      const label = idx === 0 ? '없음' : jong;
      html += `<button type="button" class="jamo-btn ${active} ${empty}" data-jong="${idx}" title="${idx === 0 ? '받침 없음 (가장 먼저)' : '받침 ' + jong + ' (' + (idx + 1) + '번째)'}">
        <span>${label}</span>
        <span class="jamo-sub">${syl}(${counts[idx]})</span>
      </button>`;
    });

    el.jongseongBar.innerHTML = html;
  }

  // ==================== 필터링 및 낱말 목록 렌더링 ====================
  function computeFilteredEntries() {
    let result = [];

    if (state.searchQuery.trim() && !state.unlistedWord && state.selectedCho === null) {
      const cleanQ = state.searchQuery.trim().replace(/\s+/g, '');
      const isCho = H.isChoseongQuery(cleanQ);
      result = state.allEntries.filter(function (entry) {
        const cleanW = entry.word.replace(/\s+/g, '');
        if (cleanW.indexOf(cleanQ) !== -1) return true;
        if (isCho && H.getChoseongString(cleanW).indexOf(cleanQ) !== -1) return true;
        return false;
      });
    } else {
      result = state.allEntries.filter(function (entry) {
        const f = getFirstCharInfo(entry);
        if (!f || !f.isHangul) return false;
        if (state.selectedCho !== null && f.choIndex !== state.selectedCho) return false;
        if (state.selectedJung !== null && f.jungIndex !== state.selectedJung) return false;
        if (state.selectedJong !== null && f.jongIndex !== state.selectedJong) return false;
        return true;
      });
    }

    result.sort(H.compareKoreanEntries);
    state.filteredEntries = result;
  }

  function renderWordList() {
    if (state.selectedCho !== null && state.selectedJung !== null && state.selectedJong !== null) {
      const syl3 = H.composeChar(state.selectedCho, state.selectedJung, state.selectedJong);
      el.listFilterTitle.textContent = `'${syl3}'으로 시작하는 낱말`;
      el.listOrderHint.textContent = `첫 글자 '${syl3}'이 같으므로 둘째 글자의 자음 → 모음 → 받침 순서로 찾아요.`;
    } else if (state.selectedCho !== null && state.selectedJung !== null) {
      const syl2 = H.composeChar(state.selectedCho, state.selectedJung, 0);
      el.listFilterTitle.textContent = `'${H.CHOSEONG[state.selectedCho]}' › '${H.JUNGSEONG[state.selectedJung]}' (${syl2}~)`;
      el.listOrderHint.textContent = `받침 없는 '${syl2}'부터 받침 순서(ㄱ→ㄴ→…→ㅎ)대로 놓여 있어요.`;
    } else if (state.selectedCho !== null) {
      const cho = H.CHOSEONG[state.selectedCho];
      el.listFilterTitle.textContent = `자음 '${cho}' 낱말`;
      el.listOrderHint.textContent = `모음 순서(ㅏ→ㅐ→ㅑ→…→ㅣ)대로 놓여 있어요.`;
    } else {
      el.listFilterTitle.textContent = '전체 낱말';
      el.listOrderHint.textContent = '자음(19) → 모음(21) → 받침(28) 공식 순서';
    }

    el.listCountText.textContent = `${state.filteredEntries.length}개`;

    if (state.filteredEntries.length === 0) {
      el.wordList.innerHTML = `<li class="word-list-empty">이 자리에 해당하는 낱말이 아직 수록되어 있지 않아요.</li>`;
      return;
    }

    const showSecondHint = state.selectedJong !== null;

    el.wordList.innerHTML = state.filteredEntries.map(function (entry) {
      const isActive = entry.id === state.selectedEntryId;
      const sup = entry.homonym ? `<sup>${entry.homonym}</sup>` : '';
      const preview = entry.senses[0] ? entry.senses[0].meaning : '';

      let step4HintHtml = '';
      if (showSecondHint) {
        const chars = H.decomposeWord(entry.word);
        if (chars.length === 1) {
          step4HintHtml = `<span class="wli-step4-hint">한 글자</span>`;
        } else if (chars[1] && chars[1].isHangul) {
          const c2 = chars[1];
          step4HintHtml = `<span class="wli-step4-hint">둘째: ${c2.char}(${c2.cho}+${c2.jung})</span>`;
        }
      }

      return `
        <li class="word-list-item ${isActive ? 'active' : ''}" data-id="${entry.id}" role="option" aria-selected="${isActive}">
          <div class="wli-top">
            <div class="wli-head">
              <span class="wli-word">${escapeHtml(entry.word)}${sup}</span>
              <span class="wli-pos">「${escapeHtml(entry.pos)}」</span>
            </div>
            ${step4HintHtml}
          </div>
          <p class="wli-preview">${escapeHtml(preview)}</p>
        </li>
      `;
    }).join('');
  }

  // ==================== 오른쪽: 기존 인터넷 국어사전 형식 상세 보기 ====================
  function highlightHeadwordInExample(example, word) {
    const safeEx = escapeHtml(example);
    const stem = word.endsWith('다') && word.length >= 2 ? word.slice(0, -1) : word;
    if (!stem) return safeEx;
    const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedStem}[가-힣]*)`, 'g');
    return safeEx.replace(regex, '<span class="example-highlight">$1</span>');
  }

  function renderAlgoSummaryList(steps) {
    if (!steps) return '';
    return `
      <ol class="algo-step-list">
        <li class="${state.demoHighlightStep === 1 ? 'demo-highlight' : ''}">
          <span class="algo-step-tag">단계 1</span>
          <span>${escapeHtml(steps.step1.desc)}</span>
        </li>
        <li class="${state.demoHighlightStep === 2 ? 'demo-highlight' : ''}">
          <span class="algo-step-tag">단계 2</span>
          <span>${escapeHtml(steps.step2.desc)}</span>
        </li>
        <li class="${state.demoHighlightStep === 3 ? 'demo-highlight' : ''}">
          <span class="algo-step-tag">단계 3</span>
          <span>${escapeHtml(steps.step3.desc)}</span>
        </li>
        <li class="${state.demoHighlightStep === 4 ? 'demo-highlight' : ''}">
          <span class="algo-step-tag">단계 4</span>
          <span>${escapeHtml(steps.step4.desc)}</span>
        </li>
      </ol>
    `;
  }

  function renderEntryDetail() {
    // 1. 사전에 없는 한글 낱말을 검색한 경우에도 4단계 알고리즘 + 사전 위치 완벽 안내!
    if (state.unlistedWord && !state.selectedEntryId) {
      const w = state.unlistedWord;
      const steps = H.getLookupSteps(w);

      // 우리 사전에서 어느 두 낱말 사이에 들어가는지 정확히 계산
      let prevEntry = null;
      let nextEntry = null;
      for (let i = 0; i < state.allEntries.length; i++) {
        const cmp = H.compareKoreanStrings(state.allEntries[i].word, w);
        if (cmp < 0) prevEntry = state.allEntries[i];
        else if (cmp > 0) {
          nextEntry = state.allEntries[i];
          break;
        }
      }

      const encoded = encodeURIComponent(w);
      el.entryDetailPanel.innerHTML = `
        <div class="not-found-box">
          <h2 class="not-found-title">'${escapeHtml(w)}' 찾는 순서 안내</h2>
          <p class="not-found-desc">
            이 낱말은 우리 교실 기본 사전에 아직 실려 있지 않지만,
            실제 국어사전에서 <strong>어느 위치에서 찾는지 4단계 순서</strong>로 알려 줄게요!
          </p>

          <div class="between-box">
            📍 <strong>국어사전 속 자리:</strong>
            ${prevEntry ? `'${escapeHtml(H.formatHeadword(prevEntry))}'` : '(사전 맨 앞)'}
            ← <strong>[ ${escapeHtml(w)} ]</strong> →
            ${nextEntry ? `'${escapeHtml(H.formatHeadword(nextEntry))}'` : '(사전 맨 끝)'}
          </div>

          <section class="algo-summary-card" style="margin-top:0;">
            <div class="algo-summary-head">
              <h3>🧭 '${escapeHtml(w)}' 국어사전에서 찾는 4단계 알고리즘</h3>
            </div>
            ${renderAlgoSummaryList(steps)}
          </section>

          <div class="ext-links">
            <a class="ext-link-btn" href="https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=${encoded}" target="_blank" rel="noopener noreferrer">
              📖 표준국어대사전에서 뜻 보기 ↗
            </a>
            <a class="ext-link-btn secondary" href="https://ko.dict.naver.com/#/search?query=${encoded}" target="_blank" rel="noopener noreferrer">
              🔍 네이버 국어사전에서 뜻 보기 ↗
            </a>
          </div>
        </div>
      `;
      return;
    }

    const entry = getSelectedEntry();
    if (!entry) {
      el.entryDetailPanel.innerHTML = `
        <div class="word-list-empty" style="padding: 80px 20px;">
          <p style="font-size:18px; font-weight:700; color:#334155;">위의 단계 1 → 단계 2 → 단계 3을 차례대로 눌러 낱말을 찾아보세요.</p>
          <p>왼쪽 단계 4 목록에서 낱말을 누르면 기존 국어사전 형식으로 뜻과 예문이 나타납니다.</p>
        </div>
      `;
      return;
    }

    const fullIndex = state.allEntries.findIndex(function (e) { return e.id === entry.id; });
    const prevEntry = fullIndex > 0 ? state.allEntries[fullIndex - 1] : null;
    const nextEntry = fullIndex < state.allEntries.length - 1 ? state.allEntries[fullIndex + 1] : null;

    const supHtml = entry.homonym ? `<sup>${entry.homonym}</sup>` : '';
    const hanjaHtml = entry.hanja ? `<span class="dict-hanja">(${escapeHtml(entry.hanja)})</span>` : '';

    // 동음이의어 전환 바
    const homonyms = state.allEntries.filter(function (e) { return e.word === entry.word; });
    let homonymBarHtml = '';
    if (homonyms.length > 1) {
      const btns = homonyms.map(function (hItem) {
        const shortHint = (hItem.senses[0] ? hItem.senses[0].meaning : '').slice(0, 14) + '…';
        return `<button type="button" class="homonym-btn ${hItem.id === entry.id ? 'active' : ''}" data-select-id="${hItem.id}">
          ${escapeHtml(hItem.word)}${H.toSuperscript(hItem.homonym)} (${escapeHtml(shortHint)})
        </button>`;
      }).join('');
      homonymBarHtml = `
        <div class="homonym-bar">
          <span class="homonym-label">📌 동음이의어:</span>
          ${btns}
        </div>
      `;
    }

    // 활용형
    const conjHtml = (entry.conjugations && entry.conjugations.length > 0)
      ? `<span class="dict-conjugation"><strong>활용</strong> (${escapeHtml(entry.conjugations.join(', '))})</span>`
      : '';

    // 뜻풀이 + 예문 (표준국어대사전 형식: 「1」, ¶)
    const sensesHtml = entry.senses.map(function (sense, idx) {
      const examplesHtml = (sense.examples && sense.examples.length > 0)
        ? `<ul class="example-list">${sense.examples.map(function (ex) {
            return `<li class="example-item"><span class="example-mark">¶</span>${highlightHeadwordInExample(ex, entry.word)}</li>`;
          }).join('')}</ul>`
        : '';
      return `
        <li class="sense-item">
          <p class="sense-meaning"><span class="sense-num">「${idx + 1}」</span>${escapeHtml(sense.meaning)}</p>
          ${examplesHtml}
        </li>
      `;
    }).join('');

    // 비슷한말 / 반대말
    function buildRelChips(words) {
      return words.map(function (w) {
        const target = state.allEntries.find(function (e) { return e.word === w; });
        if (target) {
          return `<button type="button" class="rel-chip clickable" data-select-id="${target.id}">${escapeHtml(w)}</button>`;
        }
        return `<span class="rel-chip plain">${escapeHtml(w)}</span>`;
      }).join('');
    }

    let relationsHtml = '';
    if ((entry.synonyms && entry.synonyms.length > 0) || (entry.antonyms && entry.antonyms.length > 0)) {
      relationsHtml = '<div class="dict-relations">';
      if (entry.synonyms && entry.synonyms.length > 0) {
        relationsHtml += `<div class="rel-row"><span class="rel-label syn">비슷한말</span>${buildRelChips(entry.synonyms)}</div>`;
      }
      if (entry.antonyms && entry.antonyms.length > 0) {
        relationsHtml += `<div class="rel-row"><span class="rel-label ant">반대말</span>${buildRelChips(entry.antonyms)}</div>`;
      }
      relationsHtml += '</div>';
    }

    const noteHtml = entry.note
      ? `<div class="dict-note-box"><strong>참고</strong>${escapeHtml(entry.note)}</div>`
      : '';

    const steps = H.getLookupSteps(entry.word);

    el.entryDetailPanel.innerHTML = `
      <div class="dict-entry-header">
        <div class="dict-head-row">
          <div class="dict-head-main">
            <h2 class="dict-headword">${escapeHtml(entry.word)}${supHtml}</h2>
            ${hanjaHtml}
          </div>
          <button type="button" class="btn-speak" id="speakWordBtn" data-word="${escapeHtml(entry.word)}">
            🔊 듣기
          </button>
        </div>

        <div class="dict-meta-line">
          <span class="dict-pron">[${escapeHtml(entry.pronunciation || entry.word)}]</span>
          ${conjHtml}
        </div>
        ${homonymBarHtml}
      </div>

      <div class="dict-pos-section">
        <div class="dict-pos-badge">「${escapeHtml(entry.pos)}」</div>
        <ol class="sense-list">
          ${sensesHtml}
        </ol>
      </div>

      ${relationsHtml}
      ${noteHtml}

      <section class="algo-summary-card" aria-label="이 낱말 찾는 4단계 요약">
        <div class="algo-summary-head">
          <h3>🧭 '${escapeHtml(H.formatHeadword(entry))}' 국어사전에서 찾는 순서</h3>
          <span class="order-position-badge">사전 ${fullIndex + 1} / ${state.allEntries.length}번째</span>
        </div>
        ${renderAlgoSummaryList(steps)}
        <div class="neighbor-nav">
          <button type="button" class="neighbor-btn prev" ${prevEntry ? `data-select-id="${prevEntry.id}"` : 'disabled'}>
            <span class="neighbor-dir">← 사전 앞 낱말</span>
            <span class="neighbor-word">${prevEntry ? escapeHtml(H.formatHeadword(prevEntry)) : '(처음 낱말)'}</span>
          </button>
          <button type="button" class="neighbor-btn next" ${nextEntry ? `data-select-id="${nextEntry.id}"` : 'disabled'}>
            <span class="neighbor-dir">사전 뒤 낱말 →</span>
            <span class="neighbor-word">${nextEntry ? escapeHtml(H.formatHeadword(nextEntry)) : '(마지막 낱말)'}</span>
          </button>
        </div>
      </section>
    `;
  }

  function refreshAll() {
    computeFilteredEntries();
    renderStepperAndSelectors();
    renderWordList();
    renderEntryDetail();
  }

  // ==================== 특정 낱말 선택 & 4단계 알고리즘 자동 동기화 ====================
  function selectEntryWithSteps(entryId, keepNotice) {
    clearDemoTimers();
    const entry = state.allEntries.find(function (e) { return e.id === entryId; });
    if (!entry) return;

    if (!keepNotice) state.baseformNotice = null;
    state.unlistedWord = null;
    state.selectedEntryId = entry.id;

    const first = getFirstCharInfo(entry);
    if (first && first.isHangul) {
      state.selectedCho = first.choIndex;
      state.selectedJung = first.jungIndex;
      state.selectedJong = first.jongIndex;
      state.activeStep = 4;
    }

    refreshAll();

    const activeItem = el.wordList.querySelector('.word-list-item.active');
    if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
  }

  // ==================== 단계별 찾기 시범 애니메이션 (수업 지도용!) ====================
  function playStepByStepDemo() {
    const entry = getSelectedEntry();
    const targetWord = entry ? entry.word : state.unlistedWord;
    if (!targetWord) return;

    const steps = H.getLookupSteps(targetWord);
    if (!steps) return;

    clearDemoTimers();

    // 단계 1: 자음만 선택된 상태로 시작
    state.selectedCho = steps.step1.choIndex;
    state.selectedJung = null;
    state.selectedJong = null;
    state.activeStep = 1;
    state.demoHighlightStep = 1;
    refreshAll();

    // 단계 2: 1.1초 후 모음 선택
    state.demoTimerIds.push(setTimeout(function () {
      state.selectedJung = steps.step2.jungIndex;
      state.activeStep = 2;
      state.demoHighlightStep = 2;
      refreshAll();
    }, 1100));

    // 단계 3: 2.2초 후 받침 선택
    state.demoTimerIds.push(setTimeout(function () {
      state.selectedJong = steps.step3.jongIndex;
      state.activeStep = 3;
      state.demoHighlightStep = 3;
      refreshAll();
    }, 2200));

    // 단계 4: 3.3초 후 낱말 선택 완료
    state.demoTimerIds.push(setTimeout(function () {
      state.activeStep = 4;
      state.demoHighlightStep = 4;
      refreshAll();
      const activeItem = el.wordList.querySelector('.word-list-item.active');
      if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
    }, 3300));

    // 4.8초 후 강조 해제
    state.demoTimerIds.push(setTimeout(function () {
      state.demoHighlightStep = 0;
      refreshAll();
    }, 4800));
  }

  // ==================== 스마트 검색 (표제어 + 활용형 기본형 추정 + 초성 검색 + 미등록 낱말 단계 안내) ====================
  function findSearchMatches(rawQuery) {
    const q = (rawQuery || '').trim();
    const cleanQ = q.replace(/\s+/g, '');
    if (!cleanQ) return { exact: [], baseMatches: [], partial: [] };

    // 1. 정확히 일치하는 표제어
    const exact = state.allEntries.filter(function (e) {
      return e.word.replace(/\s+/g, '') === cleanQ;
    });

    // 2. 활용형 -> 기본형 추정 (감았다 -> 감다, 걸었어요 -> 걷다, 예쁜 -> 예쁘다 등)
    const guessedBases = H.guessBaseForms(cleanQ);
    const baseMatches = [];
    if (exact.length === 0 && guessedBases.length > 0) {
      guessedBases.forEach(function (base) {
        state.allEntries.forEach(function (e) {
          if (e.word === base && baseMatches.indexOf(e) === -1) {
            baseMatches.push(e);
          }
        });
      });
    }

    // 3. 부분 일치 또는 초성 검색
    const isCho = H.isChoseongQuery(cleanQ);
    const partial = state.allEntries.filter(function (e) {
      if (exact.indexOf(e) !== -1 || baseMatches.indexOf(e) !== -1) return false;
      const cleanW = e.word.replace(/\s+/g, '');
      if (cleanW.indexOf(cleanQ) !== -1) return true;
      if (isCho && H.getChoseongString(cleanW).indexOf(cleanQ) !== -1) return true;
      return false;
    });

    return { exact, baseMatches, partial };
  }

  function executeSearch(rawQuery) {
    clearDemoTimers();
    el.autocompleteList.classList.add('hidden');

    const q = (rawQuery || '').trim();
    state.searchQuery = q;
    state.baseformNotice = null;
    state.unlistedWord = null;

    if (!q) {
      resetToStep1();
      return;
    }

    const res = findSearchMatches(q);

    // 1) 정확히 일치하는 표제어 발견 (예: '감다')
    if (res.exact.length > 0) {
      selectEntryWithSteps(res.exact[0].id, false);
      return;
    }

    // 2) 활용형 → 기본형 매칭 성공 (예: '감았다' → '감다', '예쁜' → '예쁘다')
    if (res.baseMatches.length > 0) {
      state.baseformNotice = {
        original: q,
        baseWord: res.baseMatches[0].word
      };
      selectEntryWithSteps(res.baseMatches[0].id, true);
      return;
    }

    // 3) 부분 일치 또는 초성 일치
    if (res.partial.length > 0) {
      selectEntryWithSteps(res.partial[0].id, false);
      return;
    }

    // 4) 사전에 없는 한글 낱말: 단계 1 → 2 → 3 → 4 알고리즘과 사전 속 자리를 정확히 안내!
    const cleanHangul = H.normalizeForSort(q);
    if (cleanHangul) {
      const steps = H.getLookupSteps(cleanHangul);
      state.selectedEntryId = null;
      state.unlistedWord = cleanHangul;
      if (steps) {
        state.selectedCho = steps.step1.choIndex;
        state.selectedJung = steps.step2.jungIndex;
        state.selectedJong = steps.step3.jongIndex;
        state.activeStep = 4;
      }
      refreshAll();
    } else {
      state.selectedEntryId = null;
      state.unlistedWord = null;
      refreshAll();
    }
  }

  function renderAutocomplete(rawQuery) {
    const q = (rawQuery || '').trim();
    if (!q) {
      el.autocompleteList.classList.add('hidden');
      return;
    }

    const res = findSearchMatches(q);
    const items = [];
    res.exact.forEach(function (e) { items.push({ entry: e, tag: '' }); });
    res.baseMatches.forEach(function (e) { items.push({ entry: e, tag: '기본형으로 찾기' }); });
    res.partial.forEach(function (e) { items.push({ entry: e, tag: H.isChoseongQuery(q) ? '초성 일치' : '' }); });

    if (items.length === 0) {
      el.autocompleteList.classList.add('hidden');
      return;
    }

    el.autocompleteList.innerHTML = items.slice(0, 8).map(function (it) {
      const e = it.entry;
      const sup = e.homonym ? H.toSuperscript(e.homonym) : '';
      const tagHtml = it.tag ? `<span class="ac-tag-base">${escapeHtml(it.tag)}</span>` : '';
      return `
        <li class="autocomplete-item" data-ac-id="${e.id}" data-ac-base="${it.tag === '기본형으로 찾기' ? '1' : ''}" role="option">
          <div class="ac-left">
            <span class="ac-word">${escapeHtml(e.word + sup)}</span>
            <span class="ac-pos">「${escapeHtml(e.pos)}」</span>
            <span class="ac-desc">${escapeHtml(e.senses[0] ? e.senses[0].meaning : '')}</span>
          </div>
          ${tagHtml}
        </li>
      `;
    }).join('');
    el.autocompleteList.classList.remove('hidden');
  }

  function resetToStep1() {
    clearDemoTimers();
    state.searchQuery = '';
    el.searchInput.value = '';
    el.clearSearchBtn.classList.add('hidden');
    el.autocompleteList.classList.add('hidden');

    state.selectedCho = null;
    state.selectedJung = null;
    state.selectedJong = null;
    state.selectedEntryId = null;
    state.baseformNotice = null;
    state.unlistedWord = null;
    state.activeStep = 1;
    refreshAll();
  }

  function speakKorean(text) {
    if (!('speechSynthesis' in window)) {
      alert('이 브라우저에서는 소리 듣기 기능을 지원하지 않아요.');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  }

  // ==================== 이벤트 바인딩 ====================
  function bindEvents() {
    el.brandHome.addEventListener('click', resetToStep1);
    el.resetStepsBtn.addEventListener('click', resetToStep1);
    el.replayStepsBtn.addEventListener('click', playStepByStepDemo);

    // 자음·모음 순서표 열기/닫기
    el.toggleChartBtn.addEventListener('click', function () {
      const isHidden = el.orderChartDrawer.classList.toggle('hidden');
      el.toggleChartBtn.setAttribute('aria-expanded', String(!isHidden));
    });
    el.closeChartBtn.addEventListener('click', function () {
      el.orderChartDrawer.classList.add('hidden');
      el.toggleChartBtn.setAttribute('aria-expanded', 'false');
    });

    // 검색 입력 & 자동완성
    el.searchInput.addEventListener('input', function () {
      const val = el.searchInput.value;
      el.clearSearchBtn.classList.toggle('hidden', !val);
      renderAutocomplete(val);
    });

    el.searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch(el.searchInput.value);
      } else if (e.key === 'Escape') {
        el.autocompleteList.classList.add('hidden');
      }
    });

    el.searchBtn.addEventListener('click', function () {
      executeSearch(el.searchInput.value);
    });

    el.clearSearchBtn.addEventListener('click', function () {
      resetToStep1();
      el.searchInput.focus();
    });

    el.autocompleteList.addEventListener('click', function (e) {
      const item = e.target.closest('[data-ac-id]');
      if (!item) return;
      el.autocompleteList.classList.add('hidden');
      const isBase = item.dataset.acBase === '1';
      const entry = state.allEntries.find(function (x) { return x.id === item.dataset.acId; });
      if (isBase && entry) {
        state.baseformNotice = { original: el.searchInput.value.trim(), baseWord: entry.word };
        selectEntryWithSteps(entry.id, true);
      } else {
        selectEntryWithSteps(item.dataset.acId, false);
      }
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-area')) {
        el.autocompleteList.classList.add('hidden');
      }
    });

    // 예시 칩 클릭
    el.quickBar.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-quick]');
      if (!btn) return;
      const q = btn.dataset.quick;
      el.searchInput.value = q;
      el.clearSearchBtn.classList.remove('hidden');
      executeSearch(q);
    });

    // 4단계 Step Card 클릭 -> 해당 단계로 돌아가기
    for (let s = 1; s <= 4; s++) {
      (function (stepNum) {
        el.stepCards[stepNum].addEventListener('click', function () {
          clearDemoTimers();
          state.unlistedWord = null;
          if (stepNum === 1) {
            state.activeStep = 1;
          } else if (stepNum === 2 && state.selectedCho !== null) {
            state.selectedJung = null;
            state.selectedJong = null;
            state.selectedEntryId = null;
            state.activeStep = 2;
          } else if (stepNum === 3 && state.selectedJung !== null) {
            state.selectedJong = null;
            state.selectedEntryId = null;
            state.activeStep = 3;
          } else if (stepNum === 4 && state.selectedCho !== null) {
            state.activeStep = 4;
          }
          refreshAll();
        });
      })(s);
    }

    // 단계 1: 자음 클릭 -> 단계 2로 이동!
    el.choseongBar.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cho]');
      if (!btn) return;
      clearDemoTimers();
      state.searchQuery = '';
      el.searchInput.value = '';
      el.clearSearchBtn.classList.add('hidden');
      state.baseformNotice = null;
      state.unlistedWord = null;

      state.selectedCho = parseInt(btn.dataset.cho, 10);
      state.selectedJung = null;
      state.selectedJong = null;
      state.selectedEntryId = null;
      state.activeStep = 2;
      refreshAll();
    });

    // 단계 2: 모음 클릭 -> 단계 3로 이동!
    el.jungseongBar.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-jung]');
      if (!btn) return;
      clearDemoTimers();
      state.baseformNotice = null;
      state.unlistedWord = null;

      state.selectedJung = parseInt(btn.dataset.jung, 10);
      state.selectedJong = null;
      state.selectedEntryId = null;
      state.activeStep = 3;
      refreshAll();
    });

    // 단계 3: 받침 클릭 -> 단계 4(둘째 글자·낱말 고르기)로 이동!
    el.jongseongBar.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-jong]');
      if (!btn) return;
      clearDemoTimers();
      state.baseformNotice = null;
      state.unlistedWord = null;

      state.selectedJong = parseInt(btn.dataset.jong, 10);
      state.activeStep = 4;
      computeFilteredEntries();
      state.selectedEntryId = state.filteredEntries.length > 0 ? state.filteredEntries[0].id : null;
      renderStepperAndSelectors();
      renderWordList();
      renderEntryDetail();
    });

    // 단계 4: 왼쪽 낱말 목록 클릭
    el.wordList.addEventListener('click', function (e) {
      const item = e.target.closest('.word-list-item');
      if (!item) return;
      selectEntryWithSteps(item.dataset.id, false);
    });

    // 오른쪽 상세 패널 내부 클릭 (듣기, 동음이의어, 비슷한말/반대말, 앞뒤 낱말)
    el.entryDetailPanel.addEventListener('click', function (e) {
      const speakBtn = e.target.closest('#speakWordBtn');
      if (speakBtn) {
        speakKorean(speakBtn.dataset.word);
        return;
      }
      const selBtn = e.target.closest('[data-select-id]');
      if (selBtn && !selBtn.disabled) {
        selectEntryWithSteps(selBtn.dataset.selectId, false);
      }
    });
  }

  // ==================== 초기화 ====================
  function init() {
    cacheDom();

    // 공식 국어사전 순서(자음 19 → 모음 21 → 받침 28 → 길이 → 어깨번호)로 정렬
    state.allEntries = DATA.ENTRIES.slice().sort(H.compareKoreanEntries);

    renderReferenceChart();
    bindEvents();

    // 첫 화면: '감다¹'을 예시로 단계 1(ㄱ) → 단계 2(ㅏ→가) → 단계 3(ㅁ→감) → 단계 4(감다¹)로 보여 주며
    // 학생이 바로 단계별 찾기 구조를 이해하도록 초기화
    const initial = state.allEntries.find(function (e) { return e.word === '감다' && e.homonym === 1; }) || state.allEntries[0];
    if (initial) {
      selectEntryWithSteps(initial.id, false);
    } else {
      refreshAll();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
