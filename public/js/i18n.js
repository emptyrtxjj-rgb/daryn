/* Двуязычный интерфейс: RU / KZ. Контент теста приходит от Gemini
   на языке документа и НЕ переводится переключателем. */
(function () {
  'use strict';

  const STORAGE_KEY = 'daryn.lang';
  const SUPPORTED = ['ru', 'kz'];

  const DICT = {
    ru: {
      'common.langLabel': 'Язык интерфейса',
      'common.brandSub': 'СОР • СОЧ • Контрольные',

      'nav.how': 'Как это работает',
      'nav.start': 'Начать',

      'hero.badge': 'Бесплатно • Для школьников Казахстана',
      'hero.title1': 'Преврати тест',
      'hero.accent': 'в игру',
      'hero.subtitle':
        'Загрузи СОР, СОЧ или контрольную — ИИ разберёт задания, объяснит каждый ответ и поможет понять ошибки.',
      'hero.chip1': '⚡ Разбор за минуту',
      'hero.chip2': '🧠 Объяснения к ответам',
      'hero.chip3': '🇰🇿 Русский и казахский',

      'upload.title': 'Загрузи свой тест',
      'upload.subtitle': 'СОР, СОЧ или обычная контрольная',
      'upload.dropTitle': 'Выбери файл или перетащи сюда',
      'upload.dropHint': 'PDF или DOCX · до 15 МБ',
      'upload.change': 'Заменить файл',
      'upload.remove': 'Убрать файл',
      'upload.privacy': 'Файл обрабатывается в памяти и не сохраняется на сервере',
      'upload.submit': 'Разобрать тест',
      'upload.demo': 'Посмотреть демо-квиз',
      'upload.or': 'или',
      'upload.supported': 'Поддерживаются PDF, DOCX и TXT',
      'upload.keyWarn':
        'GEMINI_API_KEY не настроен: загрузка файлов недоступна. Демо-квиз работает.',

      'loading.title': 'Дарын изучает твой тест',
      'loading.m0': 'Распознаём вопросы…',
      'loading.m1': 'Определяем правильные ответы…',
      'loading.m2': 'Готовим объяснения и критерии…',
      'loading.m3': 'Почти готово, собираем квиз…',
      'loading.hint': 'Обычно это занимает 10–30 секунд. Не закрывай страницу.',

      'features.f1t': 'Мгновенная проверка',
      'features.f1d': 'Ответ виден сразу: зелёный — верно, красный — разбираем ошибку.',
      'features.f2t': 'Объяснение, а не просто балл',
      'features.f2d': 'К каждому вопросу — научное объяснение и разбор типичной ошибки.',
      'features.f3t': 'Два языка',
      'features.f3d': 'Интерфейс на русском и казахском. Язык заданий берётся из документа.',

      'how.title': 'Как это работает',
      'how.subtitle': 'Три шага до понимания темы',
      'how.s1t': 'Загрузи тест',
      'how.s1d': 'PDF или DOCX с заданиями СОР, СОЧ или контрольной.',
      'how.s2t': 'Проходи квиз',
      'how.s2d': 'Один вопрос за раз, с прогрессом и мгновенной обратной связью.',
      'how.s3t': 'Пойми ошибки',
      'how.s3d': 'ИИ оценит открытые ответы и даст персональный совет.',

      'footer.tagline': 'Учись играя — понимай, а не зубри.',
      'footer.note': 'Сделано с ❤️ для школьников Казахстана',

      'quiz.progress': '{n} из {total}',
      'quiz.typeMc': 'Выбери ответ',
      'quiz.typeOpen': 'Открытый ответ',
      'quiz.openLabel': 'Твой ответ',
      'quiz.openPlaceholder': 'Напиши ответ своими словами…',
      'quiz.openHint': 'ИИ оценит ответ по критериям и объяснит, что улучшить.',
      'quiz.check': 'Проверить',
      'quiz.checking': 'Проверяем…',
      'quiz.next': 'Дальше',
      'quiz.finish': 'К результатам',
      'quiz.exitTitle': 'Уже уходишь?',
      'quiz.exitText': 'Прогресс этого квиза не сохранится.',
      'quiz.stay': 'Остаться',
      'quiz.leave': 'Выйти',
      'quiz.noQuizTitle': 'Квиз не найден',
      'quiz.noQuizText': 'Похоже, страница обновилась. Загрузи тест заново — это быстро.',
      'quiz.noQuizBtn': 'На главную',
      'quiz.emptyAnswer': 'Напиши хотя бы одно предложение — иначе ИИ нечего проверять.',

      'feedback.praise1': 'Отлично! 🎉',
      'feedback.praise2': 'Верно! 🔥',
      'feedback.praise3': 'Супер! ⭐',
      'feedback.praise4': 'Ты справился! 💪',
      'feedback.wrongTitle': 'Почти! Разберём ошибку',
      'feedback.partialTitle': 'Хорошее начало!',
      'feedback.correctAnswer': 'Правильный ответ',
      'feedback.explanation': 'Почему так',
      'feedback.mistake': 'Где ошибка',
      'feedback.aiFeedback': 'Комментарий Дарына',
      'feedback.criteria': 'Критерии ответа',
      'feedback.sample': 'Пример сильного ответа',
      'feedback.yourScore': 'Твой балл',
      'feedback.demoNote':
        'Демо-проверка без ИИ: оцениваем по ключевым словам, поэтому верный пересказ может остаться без балла.',
      'feedback.continue': 'Дальше',

      'results.eyebrow': 'Квиз завершён',
      'results.titleHigh': 'Великолепно! 🏆',
      'results.titleGood': 'Хорошая работа! 🌟',
      'results.titleMid': 'Ты на верном пути! 🚀',
      'results.titleLow': 'Главное — не сдаваться! 🌱',
      'results.subHigh': 'Ты отлично понял тему. Закрепи результат — пройди квиз ещё раз.',
      'results.subGood': 'Крепкий результат! Осталось закрыть пару пробелов.',
      'results.subMid': 'База уже есть. Разбери ошибки — и следующий результат будет выше.',
      'results.subLow': 'Ошибки — это карта для роста. Начни с тем, где было сложнее всего.',
      'results.scoreLabel': 'Твой результат',
      'results.accuracy': 'Точность',
      'results.correct': 'Верных',
      'results.mistakes': 'Ошибок',
      'results.aiLabel': 'Совет от Дарына',
      'results.aiSub': 'Персонально по твоим ошибкам',
      'results.aiLoading': 'Дарын готовит совет…',
      'results.aiError':
        'Не удалось загрузить совет, но главное ты уже сделал — разобрал ошибки.',
      'results.reviewTitle': 'Разбор ошибок',
      'results.noMistakes': 'Ни одной ошибки. Идеальная работа! 🎉',
      'results.retry': 'Пройти ещё раз',
      'results.new': 'Новый тест',
      'results.tip': 'Совет',
      'results.yourAnswer': 'Твой ответ',
      'results.aiRetry': 'Попробовать снова',
      'results.demoNote': 'Демо-режим: финальный совет сгенерирован без ИИ.',

      'err.fileType': 'Поддерживаются только PDF, DOCX или TXT.',
      'err.fileSize': 'Файл больше 15 МБ. Загрузи файл поменьше.',
      'err.noFile': 'Сначала выбери файл.',
      'err.noKey':
        'На сервере не настроен GEMINI_API_KEY. Добавь ключ в .env и перезапусти сервер.',
      'err.rate': 'Лимит бесплатного тарифа исчерпан. Подожди минуту и попробуй снова.',
      'err.auth': 'Ключ Gemini недействителен. Проверь GEMINI_API_KEY.',
      'err.timeout': 'ИИ отвечает слишком долго. Попробуй ещё раз.',
      'err.ai': 'ИИ временно недоступен. Попробуй ещё раз через минуту.',
      'err.parse': 'ИИ вернул неожиданный ответ. Попробуй загрузить файл ещё раз.',
      'err.noQuestions':
        'В документе не удалось найти вопросы. Проверь, что это тест с заданиями.',
      'err.emptyDoc':
        'Не удалось извлечь текст. Если это скан, сохрани PDF с текстовым слоем.',
      'err.pdfLarge':
        'Это скан без текстового слоя. Загрузи PDF до 10 МБ или документ с текстом.',
      'err.network': 'Нет связи с сервером. Проверь подключение и попробуй снова.',
      'err.generic': 'Что-то пошло не так. Попробуй ещё раз.',
      'err.upload': 'Не удалось загрузить файл.',
      'err.emptyAnswer': 'Напиши ответ, прежде чем проверять.',
      'err.answerError': 'Не удалось проверить ответ. Попробуй ещё раз.',

      'demo.badge': 'Демо',
      'demo.note': 'Демо-режим: проверка без ИИ по ключевым словам.',
      'demo.critYes': 'Демо: ключевые слова совпали с критерием.',
      'demo.critPartial': 'Демо: частичное совпадение с критерием.',
      'demo.critNo': 'Демо: ключевых слов критерия не найдено (смысл может быть верным).',
      'demo.fbFull':
        'Демо-оценка: ключевые слова покрывают критерии. В полной версии ИИ проверит ещё и смысл.',
      'demo.fbPartial':
        'Демо-оценка: часть ключевых слов совпала с критериями. Демо не понимает пересказ, поэтому в полной версии оценка будет точнее.',
      'demo.fbZero':
        'Демо не нашёл ключевых слов из критериев. Это не значит, что ответ неверный: демо сравнивает только слова. Посмотри пример сильного ответа ниже.',
    },

    kz: {
      'common.langLabel': 'Интерфейс тілі',
      'common.brandSub': 'СОР • СОЧ • Бақылау жұмыстары',

      'nav.how': 'Бұл қалай жұмыс істейді',
      'nav.start': 'Бастау',

      'hero.badge': 'Тегін • Қазақстан оқушыларына',
      'hero.title1': 'Тестті',
      'hero.accent': 'ойынға айналдыр',
      'hero.subtitle':
        'СОР, СОЧ немесе бақылау жұмысын жүкте — ЖИ тапсырмаларды талдап, әр жауапты түсіндіріп, қателерді түсінуге көмектеседі.',
      'hero.chip1': '⚡ Бір минутта талдау',
      'hero.chip2': '🧠 Жауаптарға түсіндірме',
      'hero.chip3': '🇰🇿 Орыс және қазақ тілдері',

      'upload.title': 'Тестіңді жүкте',
      'upload.subtitle': 'СОР, СОЧ немесе кәдімгі бақылау жұмысы',
      'upload.dropTitle': 'Файлды таңда немесе осында таста',
      'upload.dropHint': 'PDF немесе DOCX · 15 МБ дейін',
      'upload.change': 'Файлды ауыстыру',
      'upload.remove': 'Файлды жою',
      'upload.privacy': 'Файл жадында өңделеді және серверде сақталмайды',
      'upload.submit': 'Тестті талдау',
      'upload.demo': 'Демо-квизді көру',
      'upload.or': 'немесе',
      'upload.supported': 'PDF, DOCX және TXT қолдау көрсетіледі',
      'upload.keyWarn':
        'GEMINI_API_KEY орнатылмаған: файл жүктеу қолжетімсіз. Демо-квиз жұмыс істейді.',

      'loading.title': 'Дарын тестіңді оқып жатыр',
      'loading.m0': 'Сұрақтарды танып жатырмыз…',
      'loading.m1': 'Дұрыс жауаптарды анықтап жатырмыз…',
      'loading.m2': 'Түсіндірмелер мен критерийлерді дайындап жатырмыз…',
      'loading.m3': 'Дерлік дайын, квизді жинап жатырмыз…',
      'loading.hint': 'Әдетте 10–30 секунд алады. Бетті жаппа.',

      'features.f1t': 'Лезде тексеру',
      'features.f1d':
        'Жауап бірден көрінеді: жасыл — дұрыс, қызыл — қатені талдаймыз.',
      'features.f2t': 'Тек балл емес, түсіндірме',
      'features.f2d':
        'Әр сұраққа ғылыми түсіндірме және жиі кездесетін қатенің талдауы беріледі.',
      'features.f3t': 'Екі тіл',
      'features.f3d':
        'Интерфейс орыс және қазақ тілдерінде. Тапсырма тілі құжаттан алынады.',

      'how.title': 'Бұл қалай жұмыс істейді',
      'how.subtitle': 'Тақырыпты түсінуге үш қадам',
      'how.s1t': 'Тесті жүкте',
      'how.s1d': 'СОР, СОЧ немесе бақылау жұмысының PDF немесе DOCX файлы.',
      'how.s2t': 'Квизді орында',
      'how.s2d': 'Бір уақытта бір сұрақ, прогресс және лезде кері байланыс.',
      'how.s3t': 'Қателерді түсін',
      'how.s3d': 'ЖИ ашық жауаптарды бағалап, жеке кеңес береді.',

      'footer.tagline': 'Ойнай отырып үйрен — жаттамай, түсін.',
      'footer.note': 'Қазақстан оқушылары үшін ❤️-пен жасалды',

      'quiz.progress': '{n} / {total}',
      'quiz.typeMc': 'Жауапты таңда',
      'quiz.typeOpen': 'Ашық жауап',
      'quiz.openLabel': 'Сенің жауабың',
      'quiz.openPlaceholder': 'Жауабыңды өз сөзіңмен жаз…',
      'quiz.openHint':
        'ЖИ жауапты критерийлер бойынша бағалап, нені жақсарту керегін түсіндіреді.',
      'quiz.check': 'Тексеру',
      'quiz.checking': 'Тексеріп жатырмыз…',
      'quiz.next': 'Келесі',
      'quiz.finish': 'Нәтижелерге',
      'quiz.exitTitle': 'Кетіп қаласың ба?',
      'quiz.exitText': 'Бұл квиздің прогресі сақталмайды.',
      'quiz.stay': 'Қалу',
      'quiz.leave': 'Шығу',
      'quiz.noQuizTitle': 'Квиз табылмады',
      'quiz.noQuizText': 'Бет жаңартылған сияқты. Тестті қайта жүкте — бұл тез.',
      'quiz.noQuizBtn': 'Басты бетке',
      'quiz.emptyAnswer': 'Кемінде бір сөйлем жаз — әйтпесе ЖИ тексеруге ештеңе таппайды.',

      'feedback.praise1': 'Керемет! 🎉',
      'feedback.praise2': 'Дұрыс! 🔥',
      'feedback.praise3': 'Тамаша! ⭐',
      'feedback.praise4': 'Сен жеңдің! 💪',
      'feedback.wrongTitle': 'Дерлік! Қатені талдайық',
      'feedback.partialTitle': 'Жақсы бастама!',
      'feedback.correctAnswer': 'Дұрыс жауап',
      'feedback.explanation': 'Неге бұлай',
      'feedback.mistake': 'Қате қайда',
      'feedback.aiFeedback': 'Дарынның пікірі',
      'feedback.criteria': 'Жауап критерийлері',
      'feedback.sample': 'Күшті жауаптың үлгісі',
      'feedback.yourScore': 'Сенің ұпайың',
      'feedback.demoNote':
        'ЖИ-сыз демо-тексеру: кілт сөздер бойынша бағалаймыз, сондықтан дұрыс мазмұндағы жауап ұпайсыз қалуы мүмкін.',
      'feedback.continue': 'Келесі',

      'results.eyebrow': 'Квиз аяқталды',
      'results.titleHigh': 'Тамаша! 🏆',
      'results.titleGood': 'Жақсы жұмыс! 🌟',
      'results.titleMid': 'Сен дұрыс жолдасың! 🚀',
      'results.titleLow': 'Ең бастысы — берілмеу! 🌱',
      'results.subHigh':
        'Тақырыпты жақсы түсіндің. Нәтижені бекіту үшін квизді тағы бір рет өт.',
      'results.subGood': 'Мықты нәтиже! Бір-екі олқылықты жабу ғана қалды.',
      'results.subMid': 'Негіз бар. Қателерді талда — келесі нәтиже жоғары болады.',
      'results.subLow': 'Қателер — өсу картасы. Ең қиын тақырыптан баста.',
      'results.scoreLabel': 'Сенің нәтижең',
      'results.accuracy': 'Дәлдік',
      'results.correct': 'Дұрыс',
      'results.mistakes': 'Қателер',
      'results.aiLabel': 'Дарыннан кеңес',
      'results.aiSub': 'Қателеріңе қарай жеке',
      'results.aiLoading': 'Дарын кеңес дайындап жатыр…',
      'results.aiError':
        'Кеңесті жүктеу мүмкін болмады, бірақ ең бастысын істедің — қателерді талдадың.',
      'results.reviewTitle': 'Қателерді талдау',
      'results.noMistakes': 'Бірде-бір қате жоқ. Керемет жұмыс! 🎉',
      'results.retry': 'Қайта өту',
      'results.new': 'Жаңа тест',
      'results.tip': 'Кеңес',
      'results.yourAnswer': 'Сенің жауабың',
      'results.aiRetry': 'Қайта көру',
      'results.demoNote': 'Демо-режим: қорытынды кеңес ЖИ-сыз құрастырылды.',

      'err.fileType': 'Тек PDF, DOCX немесе TXT қолдау көрсетіледі.',
      'err.fileSize': 'Файл 15 МБ-тан үлкен. Кішірек файл жүкте.',
      'err.noFile': 'Алдымен файл таңда.',
      'err.noKey':
        'Серверде GEMINI_API_KEY орнатылмаған. Кілтті .env файлына қосып, серверді қайта іске қос.',
      'err.rate': 'Тегін тарифтің шегі бітті. Бір минут күтіп, қайта көр.',
      'err.auth': 'Gemini кілті жарамсыз. GEMINI_API_KEY-ді тексер.',
      'err.timeout': 'ЖИ тым ұзақ жауап беріп жатыр. Қайта көр.',
      'err.ai': 'ЖИ уақытша қолжетімсіз. Бір минуттан кейін қайта көр.',
      'err.parse': 'ЖИ күтпеген жауап қайтарды. Файлды қайта жүктеп көр.',
      'err.noQuestions':
        'Құжаттан сұрақтар табылмады. Оның тапсырмалары бар тест екенін тексер.',
      'err.emptyDoc':
        'Мәтінді шығару мүмкін болмады. Егер бұл скан болса, мәтіндік қабаты бар PDF сақта.',
      'err.pdfLarge':
        'Бұл мәтіндік қабаты жоқ скан. 10 МБ-қа дейінгі PDF немесе мәтіні бар құжат жүкте.',
      'err.network': 'Сервермен байланыс жоқ. Интернетті тексеріп, қайта көр.',
      'err.generic': 'Бірдеңе дұрыс болмады. Қайта көр.',
      'err.upload': 'Файлды жүктеу мүмкін болмады.',
      'err.emptyAnswer': 'Тексеру алдында жауап жаз.',
      'err.answerError': 'Жауапты тексеру мүмкін болмады. Қайта көр.',

      'demo.badge': 'Демо',
      'demo.note': 'Демо-режим: ЖИ-сыз, кілт сөздер бойынша тексеру.',
      'demo.critYes': 'Демо: кілт сөздер критерийге сәйкес келді.',
      'demo.critPartial': 'Демо: критериймен ішінара сәйкестік.',
      'demo.critNo': 'Демо: критерийдің кілт сөздері табылмады (мағынасы дұрыс болуы мүмкін).',
      'demo.fbFull':
        'Демо-баға: кілт сөздер критерийлерді қамтиды. Толық нұсқада ЖИ мағынаны да тексереді.',
      'demo.fbPartial':
        'Демо-баға: кілт сөздердің бір бөлігі сәйкес келді. Демо мазмұндауды түсінбейді, сондықтан толық нұсқада баға дәлірек болады.',
      'demo.fbZero':
        'Демо критерийлердегі кілт сөздерді таппады. Бұл жауаптың дұрыс еместігін білдірмейді: демо тек сөздерді салыстырады. Төмендегі күшті жауап үлгісін қара.',
    },
  };

  function detectInitialLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(stored)) return stored;
    const nav = (navigator.language || '').toLowerCase();
    return nav.startsWith('kk') || nav.startsWith('kz') ? 'kz' : 'ru';
  }

  let lang = detectInitialLang();

  function t(key, vars) {
    const dict = DICT[lang] || DICT.ru;
    let value = dict[key];
    if (value == null) value = DICT.ru[key];
    if (value == null) return key;
    if (vars) {
      value = value.replace(/\{(\w+)\}/g, (_, name) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`
      );
    }
    return value;
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
  }

  function syncSwitches() {
    document.querySelectorAll('[data-lang]').forEach((btn) => {
      const active = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setLang(next, options) {
    if (!SUPPORTED.includes(next) || next === lang) {
      syncSwitches();
      return;
    }
    lang = next;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === 'kz' ? 'kk' : 'ru';
    apply();
    syncSwitches();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
    if (options && options.scroll === false) return;
  }

  function getLang() {
    return lang;
  }

  function isKz() {
    return lang === 'kz';
  }

  function pointsWord(n) {
    const value = Math.abs(Number(n) || 0);
    if (lang === 'kz') return 'ұпай';
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return 'балл';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'балла';
    return 'баллов';
  }

  function formatNumber(n) {
    const value = Number(n) || 0;
    const rounded = Math.round(value * 10) / 10;
    return String(rounded).replace('.', ',');
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
  });

  onReady(() => {
    document.documentElement.lang = lang === 'kz' ? 'kk' : 'ru';
    apply();
    syncSwitches();
  });

  document.addEventListener('langchange', () => {
    apply();
    syncSwitches();
  });

  window.I18n = {
    t,
    apply,
    getLang,
    setLang,
    isKz,
    pointsWord,
    formatNumber,
    onReady,
  };
})();
