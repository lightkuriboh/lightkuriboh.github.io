/**
 * Lightweight Internationalization (i18n) Module for Film Magic PWA
 */

const FALLBACK_STRINGS = {
  en: {
    appTitle: "FILM MAGIC",
    appSubtitle: "WebAssembly C++ Engine",
    sample: "Sample",
    open: "Open",
    tune: "Tune",
    install: "Install",
    saveToDevice: "Save to Device",
    loadSamplePhoto: "Load sample test photo",
    importCustomPhoto: "Import custom photo",
    fineTuneParameters: "Fine-tune parameters",
    installApp: "Install Film Magic App",
    saveImageTitle: "Save image to local device",
    toggleFavorite: "Toggle Favorite",
    allPresets: "All Presets ({count})",
    historicFilms: "Historic Films ({count})",
    creativeEffects: "Creative Effects ({count})",
    favorites: "Favorites ({count})",
    wasmReady: "WASM Ready",
    jsEngine: "JS Engine",
    filterStrength: "Filter Strength",
    filmGrain: "Film Grain",
    vignette: "Vignette",
    exposureEV: "Exposure (EV)",
    warmthTemp: "Warmth (Temp)",
    reset: "Reset",
    dragDropText: "Drag & drop your own photo here, or use buttons above",
    savedToDevice: "Saved to device: {fileName}",
    removedFromFavorites: "Removed \"{name}\" from Favorites",
    addedToFavorites: "Added \"{name}\" to Favorites",
    noFavoritesYet: "No favorite films yet. Click the star icon on any film card to bookmark it.",
    library: "Library",
    libraryTitle: "Saved Photo Library",
    photoLibrary: "Photo Library",
    noSavedPhotos: "No saved photos yet. Export photos to save them here.",
    saveToPhotos: "Save to Photos",
    tapAndHoldToSave: "Tap and hold the image below, then choose Save to Photos.",
    done: "Done",
    tagOriginal: "ORIGINAL",
    tagFiltered: "FILTERED",
    categoryFilm: "Film",
    categoryEffect: "Effect",
    categoryBaseline: "Original",
    tuneRecipe: "Fine-Tune Recipe",
    chipAll: "All",
    sortRecent: "Recent",
    sortFilterName: "Filter Name",
    sortSize: "Size",
    noFavoritesTitle: "No favorite films yet",
    allFilmsAndEffects: "All Films & Effects",
    systemDefault: "System Default",
    autoLanguage: "Auto",
    language: "Language",
    selectLanguage: "Select Language",
    backToLibrary: "Back to Library",
    openInEditor: "Open in Editor",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    resetZoom: "Reset Zoom",
    clickToInspect: "Click to inspect"
  },
  vi: {
    appTitle: "FILM MAGIC",
    appSubtitle: "Bộ xử lý WebAssembly C++",
    sample: "Mẫu",
    open: "Mở ảnh",
    tune: "Tinh chỉnh",
    install: "Cài đặt",
    saveToDevice: "Lưu về máy",
    loadSamplePhoto: "Tải ảnh mẫu thử nghiệm",
    importCustomPhoto: "Nhập ảnh của bạn",
    fineTuneParameters: "Tinh chỉnh thông số màu",
    installApp: "Cài đặt ứng dụng Film Magic",
    saveImageTitle: "Lưu ảnh về thiết bị",
    toggleFavorite: "Đánh dấu yêu thích",
    allPresets: "Tất cả ({count})",
    historicFilms: "Phim cổ điển ({count})",
    creativeEffects: "Hiệu ứng sáng tạo ({count})",
    favorites: "Yêu thích ({count})",
    wasmReady: "WASM sẵn sàng",
    jsEngine: "Động cơ JS",
    filterStrength: "Độ đậm màu",
    filmGrain: "Hạt phim",
    vignette: "Tối góc",
    exposureEV: "Phơi sáng (EV)",
    warmthTemp: "Nhiệt độ màu",
    reset: "Đặt lại",
    dragDropText: "Kéo thả ảnh vào đây, hoặc dùng nút ở trên để mở ảnh",
    savedToDevice: "Đã lưu về thiết bị: {fileName}",
    removedFromFavorites: "Đã xóa \"{name}\" khỏi Yêu thích",
    addedToFavorites: "Đã thêm \"{name}\" vào Yêu thích",
    noFavoritesYet: "Chưa có phim yêu thích nào. Nhấn vào biểu tượng ngôi sao để lưu lại.",
    library: "Thư viện",
    libraryTitle: "Thư viện ảnh đã lưu",
    photoLibrary: "Thư viện ảnh",
    noSavedPhotos: "Chưa có ảnh đã lưu nào. Hãy xuất ảnh để lưu vào đây.",
    saveToPhotos: "Lưu vào Ảnh",
    tapAndHoldToSave: "Chạm và giữ hình ảnh bên dưới, sau đó chọn Lưu vào Ảnh.",
    done: "Xong",
    tagOriginal: "ẢNH GỐC",
    tagFiltered: "ĐÃ LỌC",
    categoryFilm: "Phim",
    categoryEffect: "Hiệu ứng",
    categoryBaseline: "Ảnh gốc",
    tuneRecipe: "Công thức tinh chỉnh",
    chipAll: "Tất cả",
    sortRecent: "Gần đây",
    sortFilterName: "Tên bộ lọc",
    sortSize: "Kích thước",
    noFavoritesTitle: "Chưa có phim yêu thích",
    allFilmsAndEffects: "Tất cả phim & hiệu ứng",
    systemDefault: "Mặc định hệ thống",
    autoLanguage: "Tự động",
    language: "Ngôn ngữ",
    selectLanguage: "Chọn ngôn ngữ",
    backToLibrary: "Quay lại Thư viện",
    openInEditor: "Mở trong Trình chỉnh sửa",
    zoomIn: "Phóng to",
    zoomOut: "Thu nhỏ",
    resetZoom: "Đặt lại thu phóng",
    clickToInspect: "Nhấn để xem chi tiết"
  },
  ja: {
    appTitle: "フィルムマジック",
    appSubtitle: "WebAssembly C++ エンジン",
    sample: "サンプル",
    open: "開く",
    tune: "微調整",
    install: "インストール",
    saveToDevice: "デバイスに保存",
    loadSamplePhoto: "テスト用サンプル写真を読み込む",
    importCustomPhoto: "写真を読み込む",
    fineTuneParameters: "パラメーター微調整",
    installApp: "Film Magic アプリをインストール",
    saveImageTitle: "画像を端末に保存",
    toggleFavorite: "お気に入りの切り替え",
    allPresets: "すべてのプリセット ({count})",
    historicFilms: "ヒストリックフィルム ({count})",
    creativeEffects: "クリエイティブ効果 ({count})",
    favorites: "お気に入り ({count})",
    wasmReady: "WASM 準備完了",
    jsEngine: "JS エンジン",
    filterStrength: "フィルター強度",
    filmGrain: "フィルム粒子",
    vignette: "周辺減光",
    exposureEV: "露出補正 (EV)",
    warmthTemp: "色温度 (暖色/寒色)",
    reset: "リセット",
    dragDropText: "写真をここにドラッグ＆ドロップ、または上のボタンから選択",
    savedToDevice: "端末に保存しました: {fileName}",
    removedFromFavorites: "\"{name}\" をお気に入りから削除しました",
    addedToFavorites: "\"{name}\" をお気に入りに追加しました",
    noFavoritesYet: "お気に入りのフィルムはまだありません。星アイコンをタップして登録できます。",
    library: "ライブラリ",
    libraryTitle: "保存した写真ライブラリ",
    photoLibrary: "写真ライブラリ",
    noSavedPhotos: "保存された写真はまだありません。写真をエクスポートするとここに表示されます。",
    saveToPhotos: "写真に保存",
    tapAndHoldToSave: "下の画像を長押しして「写真に保存」を選択してください。",
    done: "完了",
    tagOriginal: "オリジナル",
    tagFiltered: "フィルター適用",
    categoryFilm: "フィルム",
    categoryEffect: "エフェクト",
    categoryBaseline: "オリジナル",
    tuneRecipe: "微調整レシピ",
    chipAll: "すべて",
    sortRecent: "最新",
    sortFilterName: "フィルター名",
    sortSize: "ファイルサイズ",
    noFavoritesTitle: "お気に入りのフィルムがありません",
    allFilmsAndEffects: "すべてのフィルム＆効果",
    systemDefault: "システム標準",
    autoLanguage: "自動",
    language: "言語",
    selectLanguage: "言語を選択",
    backToLibrary: "ライブラリに戻る",
    openInEditor: "エディターで開く",
    zoomIn: "拡大",
    zoomOut: "縮小",
    resetZoom: "ズームリセット",
    clickToInspect: "クリックして詳細表示"
  },
  'zh-Hans': {
    appTitle: "胶片魔法",
    appSubtitle: "WebAssembly C++ 引擎",
    sample: "示例",
    open: "打开",
    tune: "微调",
    install: "安装",
    saveToDevice: "保存到设备",
    loadSamplePhoto: "载入测试示例照片",
    importCustomPhoto: "导入自定义照片",
    fineTuneParameters: "微调滤镜参数",
    installApp: "安装胶片魔法应用",
    saveImageTitle: "保存照片到本地设备",
    toggleFavorite: "收藏/取消收藏",
    allPresets: "全部预设 ({count})",
    historicFilms: "历史经典胶片 ({count})",
    creativeEffects: "创意风格滤镜 ({count})",
    favorites: "我的收藏 ({count})",
    wasmReady: "WASM 已就绪",
    jsEngine: "JS 引擎",
    filterStrength: "滤镜强度",
    filmGrain: "胶片颗粒",
    vignette: "暗角效果",
    exposureEV: "曝光补偿 (EV)",
    warmthTemp: "色温调节 (暖/冷)",
    reset: "重置参数",
    dragDropText: "拖拽照片到此处，或使用上方按钮导入",
    savedToDevice: "已保存到设备: {fileName}",
    removedFromFavorites: "已从收藏中移除 \"{name}\"",
    addedToFavorites: "已添加 \"{name}\" 到收藏",
    noFavoritesYet: "暂无收藏胶片。点击任意胶片卡片上的星标即可添加收藏。",
    library: "图库",
    libraryTitle: "已保存照片图库",
    photoLibrary: "照片图库",
    noSavedPhotos: "暂无保存的照片。导出照片即可在此查看。",
    saveToPhotos: "保存到相册",
    tapAndHoldToSave: "长按下方图片，然后选择“保存到相册”。",
    done: "完成",
    tagOriginal: "原图",
    tagFiltered: "滤镜效果",
    categoryFilm: "胶片",
    categoryEffect: "特效",
    categoryBaseline: "原图",
    tuneRecipe: "微调配方",
    chipAll: "全部",
    sortRecent: "最新",
    sortFilterName: "滤镜名称",
    sortSize: "文件大小",
    noFavoritesTitle: "暂无收藏的胶片",
    allFilmsAndEffects: "全部胶片与效果",
    systemDefault: "系统默认",
    autoLanguage: "自动",
    language: "语言",
    selectLanguage: "选择语言",
    backToLibrary: "返回图库",
    openInEditor: "在编辑器中打开",
    zoomIn: "放大",
    zoomOut: "缩小",
    resetZoom: "重置缩放",
    clickToInspect: "点击查看大图"
  },
  'zh-Hant': {
    appTitle: "膠片魔法",
    appSubtitle: "WebAssembly C++ 引擎",
    sample: "範例",
    open: "開啟",
    tune: "微調",
    install: "安裝",
    saveToDevice: "儲存至裝置",
    loadSamplePhoto: "載入測試範例照片",
    importCustomPhoto: "匯入自訂照片",
    fineTuneParameters: "微調濾鏡參數",
    installApp: "安裝膠片魔法應用程式",
    saveImageTitle: "儲存照片至本機裝置",
    toggleFavorite: "收藏/取消收藏",
    allPresets: "全部預設 ({count})",
    historicFilms: "歷史經典底片 ({count})",
    creativeEffects: "創意風格濾鏡 ({count})",
    favorites: "我的收藏 ({count})",
    wasmReady: "WASM 已就緒",
    jsEngine: "JS 引擎",
    filterStrength: "濾鏡強度",
    filmGrain: "底片顆粒",
    vignette: "暗角效果",
    exposureEV: "曝光補償 (EV)",
    warmthTemp: "色溫調整 (暖/冷)",
    reset: "重設參數",
    dragDropText: "拖放照片至此處，或使用上方按鈕匯入",
    savedToDevice: "已儲存至裝置: {fileName}",
    removedFromFavorites: "已從收藏中移除 \"{name}\"",
    addedToFavorites: "已新增 \"{name}\" 至收藏",
    noFavoritesYet: "暫無收藏底片。點選任意底片卡片上的星標即可加入收藏。",
    library: "圖庫",
    libraryTitle: "已儲存照片圖庫",
    photoLibrary: "照片圖庫",
    noSavedPhotos: "暫無儲存的照片。匯出照片即可在此查看。",
    saveToPhotos: "儲存至相簿",
    tapAndHoldToSave: "長按下方圖片，然後選擇「儲存至相簿」。",
    done: "完成",
    tagOriginal: "原圖",
    tagFiltered: "濾鏡效果",
    categoryFilm: "膠片",
    categoryEffect: "特效",
    categoryBaseline: "原圖",
    tuneRecipe: "微調配方",
    chipAll: "全部",
    sortRecent: "最新",
    sortFilterName: "濾鏡名稱",
    sortSize: "檔案大小",
    noFavoritesTitle: "尚無收藏的膠片",
    allFilmsAndEffects: "全部底片與效果",
    systemDefault: "系統預設",
    autoLanguage: "自動",
    language: "語言",
    selectLanguage: "選擇語言",
    backToLibrary: "返回圖庫",
    openInEditor: "在編輯器中開啟",
    zoomIn: "放大",
    zoomOut: "縮小",
    resetZoom: "重設縮放",
    clickToInspect: "點擊查看大圖"
  }
};

class I18n {
  constructor(initialLocale = null, dictionaries = {}) {
    this.supported = ['en', 'zh-Hans', 'zh-Hant', 'vi', 'ja'];
    this.dictionaries = { ...FALLBACK_STRINGS, ...dictionaries };
    this.locale = initialLocale || this.detectLocale();
  }

  detectLocale(urlSearch, storageVal, browserLang) {
    let urlParam = null;
    if (urlSearch !== undefined && urlSearch !== null) {
      const match = urlSearch.match(/[?&]lang=([^&#]*)/);
      if (match) urlParam = decodeURIComponent(match[1]);
    } else if (typeof location !== 'undefined') {
      urlParam = new URLSearchParams(location.search).get('lang');
    }

    let stored = storageVal;
    if (stored === undefined && typeof localStorage !== 'undefined') {
      try {
        stored = localStorage.getItem('film_magic_locale');
      } catch (_) {}
    }
    if (stored === 'auto' || stored === 'system') {
      stored = null;
    }

    let navLang = browserLang;
    if (navLang === undefined && typeof navigator !== 'undefined') {
      navLang = navigator.language || (navigator.languages && navigator.languages[0]);
    }

    const candidate = urlParam || stored || navLang || 'en';
    const lower = candidate.toLowerCase();

    if (lower.startsWith('zh-hant') || lower === 'zh-tw' || lower === 'zh-hk') {
      return 'zh-Hant';
    }
    if (lower.startsWith('zh')) {
      return 'zh-Hans';
    }
    if (lower.startsWith('ja')) {
      return 'ja';
    }
    if (lower.startsWith('vi')) {
      return 'vi';
    }
    if (lower.startsWith('en')) {
      return 'en';
    }
    return 'en';
  }

  setDictionary(locale, dict) {
    this.dictionaries[locale] = { ...(this.dictionaries[locale] || {}), ...dict };
  }

  async loadLocale(locale) {
    if (this.dictionaries[locale] && Object.keys(this.dictionaries[locale]).length > 1) {
      return;
    }
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch(`i18n/${locale}.json`);
        if (res.ok) {
          const data = await res.json();
          this.setDictionary(locale, data);
        }
      } catch (err) {
        console.warn(`Failed to fetch translations for ${locale}:`, err);
      }
    }
  }

  async setLocale(locale) {
    let effectiveLocale = locale;
    if (locale === 'auto' || locale === 'system') {
      effectiveLocale = this.detectLocale(undefined, null);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('film_magic_locale', 'auto');
        } catch (_) {}
      }
    } else {
      if (!this.supported.includes(locale)) {
        locale = 'en';
        effectiveLocale = 'en';
      }
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('film_magic_locale', locale);
        } catch (_) {}
      }
    }

    this.locale = effectiveLocale;
    await this.loadLocale(effectiveLocale);
    this.applyToDOM();

    if (typeof document !== 'undefined') {
      document.documentElement.lang = effectiveLocale;
      const event = new CustomEvent('localechange', { detail: { locale: effectiveLocale, preference: locale } });
      document.dispatchEvent(event);
    }
  }

  t(key, params = {}) {
    const activeDict = this.dictionaries[this.locale] || {};
    const fallbackDict = this.dictionaries['en'] || {};
    let str = activeDict[key] !== undefined ? activeDict[key] : (fallbackDict[key] !== undefined ? fallbackDict[key] : key);

    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return str;
  }

  applyToDOM() {
    if (typeof document === 'undefined') return;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      el.textContent = this.t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.dataset.i18nTitle;
      el.title = this.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      el.placeholder = this.t(key);
    });
  }
}

if (typeof window !== 'undefined') {
  window.I18n = I18n;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18n, FALLBACK_STRINGS };
}
