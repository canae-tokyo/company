document.addEventListener('DOMContentLoaded', () => {

    /* ---------- ヘッダー：スクロールに応じて背景を出現 ---------- */
    const header = document.getElementById('header');
    const toggleHeaderState = () => {
        if (!header) return;
        if (window.scrollY > 40) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    toggleHeaderState();
    window.addEventListener('scroll', toggleHeaderState, { passive: true });

    /* ---------- ヒーロー背景のスムーズパララックス ---------- */
    const heroBg = document.querySelector('.hero-bg');
    if (heroBg) {
        window.addEventListener('scroll', () => {
            const scroll = window.pageYOffset;
            // ズームアウトと干渉しないよう、translate3dで滑らかに下方へシフト
            if (scroll < window.innerHeight) {
                heroBg.style.transform = `translate3d(0, ${scroll * 0.25}px, 0)`;
            }
        }, { passive: true });
    }

    /* ---------- ページロード時にヒーローエリア内の要素を即座にアニメーション開始 ---------- */
    setTimeout(() => {
        document.querySelectorAll('#hero .fade-up').forEach(el => {
            el.classList.add('active');
        });
    }, 150); // 微小なラグを置いて美しく滑らかに開始

    /* ---------- スクロール連動フェードイン（IntersectionObserver） ---------- */
    const revealTargets = Array.from(document.querySelectorAll('.fade-up')).filter(
        el => !el.closest('#hero')
    );

    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -60px 0px'
        });

        revealTargets.forEach(el => revealObserver.observe(el));
    } else {
        // IntersectionObserver 非対応環境では即時表示
        revealTargets.forEach(el => el.classList.add('active'));
    }

    /* ---------- ナビゲーションの滑らかスクロール（イージング付き） ---------- */
    const getHeaderHeight = () => (header ? header.offsetHeight : 0);
    const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const smoothScrollTo = (targetY, duration = 900) => {
        const startY = window.pageYOffset;
        const diff = targetY - startY;
        let startTime = null;

        const step = (timestamp) => {
            if (startTime === null) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            window.scrollTo(0, startY + diff * easeInOutCubic(progress));
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    };

    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const hash = link.getAttribute('href');
            if (!hash || hash.length < 2) return;
            const target = document.querySelector(hash);
            if (!target) return;
            e.preventDefault();
            const targetY = target.getBoundingClientRect().top + window.pageYOffset - getHeaderHeight() + 1;
            smoothScrollTo(targetY);
        });
    });

    /* ---------- メールアドレスの表示組み立て（クローラー対策） ---------- */
    const emailEl = document.getElementById('contact-email');
    if (emailEl) {
        const user = 'hello';
        const domain = 'canae.tokyo';
        emailEl.textContent = `${user}@${domain}`;
    }
});
