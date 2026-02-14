document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentState = {
        view: 'setup',
        currentPhase: 1,
        startTime: null,
        timerInterval: null,
        remainingSeconds: 60 * 60,
        member: {
            name: '',
            age: '',
            notes: ''
        },
        scores: {
            a1: 3, a2: 3, a3: 3,
            b1: 3, b2: 3, b3: 3, b4: 3,
            c1: 3, c2: 3, c3: 3
        },
        quickNotes: '',
        observations: {
            phrase: '',
            gesture: '',
            negative: ''
        }
    };

    const phaseData = {
        1: {
            title: "Phase 1: 待ち合わせ〜移動 (5分)",
            script: [
                "【0:00】待ち合わせ地点に到着。バッグを持ち、スマホを見て待機。",
                "【0:01】会員が近づいてきたら観察：笑顔・視線・挨拶・姿勢をチェック。",
                "台本：「あ、〇〇さんですか？初めまして、今日はよろしくお願いします。」",
                "台本：「今日は対人スキルの評価セッションということで、リラックスして大丈夫ですよ。」",
                "【0:02-0:05】移動。バッグを重そうに持つ、歩行速度を合わせてくれるか観察。"
            ],
            checkpoints: ["笑顔の有無", "アイコンタクト", "挨拶の声量", "荷物への気遣い"]
        },
        2: {
            title: "Phase 2: 入店〜着席〜注文 (10分)",
            script: [
                "【入店】ドアを開けて待ってくれるか、店員への態度を観察。",
                "【席選び】仕掛け：「どこに座りましょうか？」と委ねる。奥の席を譲るか？",
                "【注文】仕掛け：「ここ初めてなんです。何がおすすめですかね？」",
                "注文時の決断力、店員への言葉遣い、相手を急かさないかをチェック。"
            ],
            checkpoints: ["ドア開け待機", "席の配慮(奥の席)", "メニューの相談", "店員への感謝"]
        },
        3: {
            title: "Phase 3: メイン対話 (35分)",
            script: [
                "【ブロック1】アイスブレイク。「お仕事と休日の過ごし方を教えてもらえますか？」",
                "【ブロック2】深掘り。「それ、どうして始めたんですか？」感情を深掘り。",
                "【負荷1】沈黙耐性テスト。5秒間無言で待つ。焦らず次を出せるか。",
                "【負荷2】曖昧返答テスト。「時と場合によりますね」への反応。",
                "会話比率 理想 3:7。質問の数と質を重点的に評価。"
            ],
            checkpoints: ["質問の深掘り", "共感リアクション", "沈melt耐性", "会話のバランス"]
        },
        4: {
            title: "Phase 4: 会計〜解散 (10分)",
            script: [
                "【会計】仕掛け：「ごちそうさまでした。私の分も払いますね」と財布を出す。",
                "スマートに「今日は僕が」と言えるか。感謝を伝えられるか。",
                "【最後の移動】「今日の会話、自分で気づいたことはありますか？」と聞く。",
                "【解散】「ありがとうございました。フィードバックは明日までに送ります。」"
            ],
            checkpoints: ["会計のスマートさ", "客観的な自己認識", "別れ際の笑顔", "最後の感謝"]
        }
    };

    // --- DOM Elements ---
    const views = {
        setup: document.getElementById('setup-view'),
        dashboard: document.getElementById('dashboard-view'),
        scoring: document.getElementById('scoring-view')
    };

    const timerEl = document.getElementById('session-timer');
    const phaseContentEl = document.getElementById('phase-content');
    const totalScoreEl = document.getElementById('total-score');
    const rankLabelEl = document.getElementById('rank-label');
    const feedbackDisplayEl = document.getElementById('feedback-display');
    const feedbackEditEl = document.getElementById('feedback-edit');
    const feedbackResultArea = document.getElementById('feedback-result');

    // --- View Navigation ---
    function switchView(viewName) {
        Object.keys(views).forEach(v => views[v].classList.remove('active'));
        views[viewName].classList.add('active');
        currentState.view = viewName;
    }

    // --- Timer Logic ---
    function startTimer() {
        currentState.startTime = new Date();
        currentState.timerInterval = setInterval(() => {
            currentState.remainingSeconds--;
            updateTimerDisplay();
            if (currentState.remainingSeconds <= 0) {
                clearInterval(currentState.timerInterval);
                alert("セッション終了時間です。");
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const mins = Math.floor(currentState.remainingSeconds / 60);
        const secs = currentState.remainingSeconds % 60;
        timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (mins < 5) timerEl.classList.add('alert-urgent');
        else timerEl.classList.remove('alert-urgent');
    }

    // --- Phase Management ---
    function renderPhase(phaseNum) {
        const data = phaseData[phaseNum];
        let html = `<h3>${data.title}</h3>`;

        html += `<div class="script-box" style="margin: 2rem 0;">`;
        data.script.forEach(line => {
            html += `<div class="script-line" onclick="this.classList.toggle('completed')">${line}</div>`;
        });
        html += `</div>`;

        html += `<h4>チェックポイント</h4><div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem;">`;
        data.checkpoints.forEach(cp => {
            html += `<span class="glass" style="padding: 0.5rem 1rem; border-radius: 50px; font-size: 0.8rem;">${cp}</span>`;
        });
        html += `</div>`;

        phaseContentEl.innerHTML = html;

        // Update Nav
        document.querySelectorAll('.phase-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.phase) === phaseNum);
        });
    }

    // --- Scoring Logic ---
    function updateScoreDisplay() {
        const total = Object.values(currentState.scores).reduce((a, b) => a + b, 0);
        totalScoreEl.innerHTML = `${total}<span style="font-size: 1.5rem; color: var(--text-secondary);"> / 50</span>`;

        let rank = "";
        if (total >= 45) rank = "優秀";
        else if (total >= 40) rank = "良好";
        else if (total >= 35) rank = "平均上";
        else if (total >= 30) rank = "平均";
        else if (total >= 25) rank = "平均下";
        else if (total >= 20) rank = "要改善";
        else rank = "重大な課題";

        rankLabelEl.textContent = `評価：${rank}`;
    }

    function renderScoringGrid() {
        const items = [
            { id: 'a1', label: 'A-1. 清潔感' },
            { id: 'a2', label: 'A-2. 笑顔の自然さ' },
            { id: 'a3', label: 'A-3. 声のトーン' },
            { id: 'b1', label: 'B-1. 質問力' },
            { id: 'b2', label: 'B-2. 話題の展開力' },
            { id: 'b3', label: 'B-3. 共感表現' },
            { id: 'b4', label: 'B-4. 沈黙への対応' },
            { id: 'c1', label: 'C-1. 相手への配慮' },
            { id: 'c2', label: 'C-2. リード力' },
            { id: 'c3', label: 'C-3. 別れ際の印象' }
        ];

        const grid = document.querySelector('.scoring-grid');
        grid.innerHTML = '<h3 style="color: var(--accent-gold); margin-bottom: 1rem;">10項目評価</h3>';

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'score-item';
            div.innerHTML = `
                <span>${item.label}</span>
                <div class="score-buttons" data-item="${item.id}">
                    ${[1, 2, 3, 4, 5].map(v => `<button class="score-btn ${currentState.scores[item.id] === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                </div>
            `;
            grid.appendChild(div);
        });

        // Add event listeners to score buttons
        document.querySelectorAll('.score-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const parent = e.target.parentElement;
                const itemId = parent.dataset.item;
                const val = parseInt(e.target.dataset.val);

                currentState.scores[itemId] = val;
                parent.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                updateScoreDisplay();
                saveState();
            });
        });
    }

    // --- Feedback Generation ---
    function generateFeedbackContent() {
        const total = Object.values(currentState.scores).reduce((a, b) => a + b, 0);
        const { name } = currentState.member;

        let strength = "";
        let improvement = "";
        let action = "";

        // logic based on scores
        if (currentState.scores.a1 >= 4 && currentState.scores.a2 >= 4) {
            strength = "第一印象が非常に良好でした。清潔感があり笑顔で挨拶ができていたため、スムーズに診断をスタートできました。";
        } else if (currentState.scores.c2 >= 4) {
            strength = "リード力が素晴らしく、店選びや注文時の配慮が自然で、相手を不安にさせないスマートな振る舞いが見られました。";
        } else {
            strength = "待ち合わせの時間通りの到着や、基本的な挨拶など、礼儀正しい姿勢は高く評価できます。";
        }

        if (currentState.scores.b1 <= 2) {
            improvement = "質問が少なく、会話が一方的になる傾向がありました。相手への関心を示す「問いかけ」が不足しており、相手が『話を聞いてもらえていない』と感じるリスクがあります。";
            action = "「2:1ルール」を意識してください。自分が2つ話したら、必ず1つ相手に質問を返します。まずは『〇〇さんはどうですか？』という一言から始めてみましょう。";
        } else if (currentState.scores.b4 <= 2) {
            improvement = "沈黙に対する焦りが見られました。無言の時間に耐えきれず「えーっと」と言葉を探す場面があり、リラックスした空間作りが課題です。";
            action = "「3つの話題ストック」を常に持っておきましょう。最近のトレンド、季節の話、相手の話の深掘りを用意しておくだけで、沈黙を恐れず自然な間を作れるようになります。";
        } else {
            improvement = "基本的な会話は成立していましたが、さらなる高みを目指すには、相手の感情にフォーカスした深い共感（バックトラッキング等）を取り入れると、より魅力が増します。";
            action = "相手が話した感情のキーワードを拾い、「それは〇〇でしたね」と共鳴する練習を取り入れてみてください。";
        }

        const { phrase, gesture, negative } = currentState.observations;

        const template = `■ IKETEL 診断レポート：${name} 様

【総合スコア：${total} / 50点】

【今回の強み】
${strength}

【改善ポイント】
${improvement}

【特記事項：所作・振る舞い】
・口癖：${phrase || '特になし'}
・仕草：${gesture || '良好'}
・気になる点：${negative || '特になし'}

【次回へのアクション】
${action}

----------------------------------------
今回の診断結果に基づき、更なる向上を目指しましょう。
今後の改善により、対人魅力は確実にアップします。
応援しています。
`;
        return template;
    }

    // --- Persistence ---
    function saveState() {
        localStorage.setItem('iketel_session', JSON.stringify(currentState));
    }

    function loadState() {
        const saved = localStorage.getItem('iketel_session');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Resume only if it was an active session
            if (parsed.view !== 'setup') {
                currentState = parsed;
                switchView(currentState.view);
                if (currentState.view === 'dashboard') {
                    renderPhase(currentState.currentPhase);
                    startTimer();
                } else if (currentState.view === 'scoring') {
                    renderScoringGrid();
                    updateScoreDisplay();
                }
            }
        }
    }

    // --- Interaction Listeners ---
    document.getElementById('start-session').addEventListener('click', () => {
        const nameInput = document.getElementById('member-name').value.trim();
        currentState.member.name = nameInput || 'ゲスト';
        currentState.member.age = document.getElementById('member-age').value;
        currentState.member.notes = document.getElementById('member-notes').value;

        switchView('dashboard');
        renderPhase(1);
        startTimer();
        saveState();
    });

    document.getElementById('next-phase').addEventListener('click', () => {
        if (currentState.currentPhase < 4) {
            currentState.currentPhase++;
            renderPhase(currentState.currentPhase);
            saveState();
        } else {
            alert("全フェーズ完了しました。診断終了ボタンを押してください。");
        }
    });

    document.getElementById('prev-phase').addEventListener('click', () => {
        if (currentState.currentPhase > 1) {
            currentState.currentPhase--;
            renderPhase(currentState.currentPhase);
            saveState();
        }
    });

    document.getElementById('finish-session').addEventListener('click', () => {
        if (confirm("診断を終了し、評価入力へ進みますか？")) {
            clearInterval(currentState.timerInterval);
            switchView('scoring');
            renderScoringGrid();
            updateScoreDisplay();
            saveState();
        }
    });

    document.getElementById('generate-feedback').addEventListener('click', () => {
        // Collect latest observation data
        currentState.observations.phrase = document.getElementById('obs-phrase').value;
        currentState.observations.gesture = document.getElementById('obs-gesture').value;
        currentState.observations.negative = document.getElementById('obs-negative').value;
        currentState.quickNotes = document.getElementById('quick-notes').value;

        const feedback = generateFeedbackContent();
        feedbackDisplayEl.textContent = feedback;
        feedbackEditEl.value = feedback;

        feedbackResultArea.style.display = 'block';
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        saveState();
    });

    document.getElementById('toggle-edit').addEventListener('click', (e) => {
        const isEditing = feedbackEditEl.style.display === 'block';
        if (isEditing) {
            // Save from textarea back to display
            feedbackDisplayEl.textContent = feedbackEditEl.value;
            feedbackEditEl.style.display = 'none';
            feedbackDisplayEl.style.display = 'block';
            e.target.textContent = '編集モード';
            e.target.classList.remove('btn-primary');
        } else {
            // Sync current display to textarea and show
            feedbackEditEl.value = feedbackDisplayEl.textContent;
            feedbackDisplayEl.style.display = 'none';
            feedbackEditEl.style.display = 'block';
            e.target.textContent = '保存する';
            e.target.classList.add('btn-primary');
        }
    });

    document.getElementById('copy-feedback').addEventListener('click', () => {
        const content = feedbackEditEl.style.display === 'block' ? feedbackEditEl.value : feedbackDisplayEl.textContent;
        navigator.clipboard.writeText(content);
        alert("レポートをクリップボードにコピーしました。");
    });

    document.getElementById('restart-app').addEventListener('click', () => {
        if (confirm("現在のデータをクリアして、新しい診断を開始しますか？")) {
            localStorage.removeItem('iketel_session');
            location.reload();
        }
    });

    // Load test buttons (simulated impact)
    document.querySelectorAll('[data-test]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const test = e.target.dataset.test;
            alert(`${test} テストを実施しました。結果をメモしてください。`);
        });
    });
    // --- Initialization ---
    loadState();
});
