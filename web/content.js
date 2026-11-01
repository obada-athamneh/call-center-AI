// Website content, taken from company_info.txt (fictional company, for learning).
// Item ids are what the voice tools point at: e.g. show_prices(item="home_5kw") -> "price-home_5kw".

export const services = [
  { key: "home_solar", title: "طاقة شمسية للبيوت", text: "أنظمة مربوطة على الشبكة بتخفّض فاتورة الكهربا من أول شهر.", icon: "home" },
  { key: "business_solar", title: "المصانع والشركات", text: "أنظمة بأحجام كبيرة للمصانع والمحلات والمكاتب.", icon: "factory" },
  { key: "farm_water_pumps", title: "ضخ المياه للمزارع", text: "مضخات بتشتغل على الشمس، بدون ديزل وبدون فاتورة.", icon: "drop" },
  { key: "solar_water_heaters", title: "سخانات شمسية", text: "مي سخنة طول السنة بأقل كلفة.", icon: "heater" },
  { key: "battery_storage", title: "بطاريات تخزين", text: "بطاريات ليثيوم بتخزّن طاقة النهار لليل.", icon: "battery" },
  { key: "ev_chargers", title: "شواحن سيارات كهربائية", text: "شاحن بالبيت مع التركيب.", icon: "plug" },
  { key: "maintenance", title: "صيانة وتنظيف الألواح", text: "زيارات دورية بترجّع الألواح لأعلى إنتاج.", icon: "brush" },
  { key: "free_site_study", title: "دراسة جدوى مجانية", text: "زيارة موقع ودراسة مجانية داخل عمّان.", icon: "clipboard" },
];

export const prices = [
  { key: "home_5kw", title: "نظام بيت 5 كيلوواط", price: "2,900" },
  { key: "home_10kw", title: "نظام بيت 10 كيلوواط", price: "5,400" },
  { key: "battery_5kwh", title: "بطارية تخزين 5 كيلوواط ساعة", price: "1,600" },
  { key: "water_heater_200l", title: "سخان شمسي 200 لتر", price: "450" },
  { key: "ev_charger", title: "شاحن سيارة كهربائية للبيت (مع التركيب)", price: "650" },
  { key: "maintenance_visit", title: "زيارة صيانة وتنظيف للبيت", price: "35" },
];
export const pricesNote = "الأسعار تقريبية وبتتغيّر حسب الموقع ونوع السطح. السعر النهائي بينعطى بعد زيارة الموقع.";

export const payment = [
  { key: "methods", title: "طرق الدفع", text: "كاش، تحويل بنكي، أو بطاقة." },
  { key: "installments", title: "تقسيط بدون فوائد", text: "لغاية 36 شهر بالتعاون مع بنك الأمل." },
  { key: "down_payment", title: "الدفعة الأولى", text: "20% من قيمة النظام." },
];

export const warranty = [
  { key: "panels", title: "الألواح الشمسية", years: "25", unit: "سنة", text: "كفالة على الأداء" },
  { key: "inverter", title: "الإنفرتر", years: "10", unit: "سنين", text: "كفالة كاملة" },
  { key: "batteries", title: "البطاريات", years: "8", unit: "سنين", text: "كفالة كاملة" },
  { key: "installation", title: "التركيب", years: "5", unit: "سنين", text: "كفالة على الشغل" },
  { key: "free_maintenance", title: "صيانة مجانية", years: "1", unit: "سنة", text: "زيارتين بأول سنة" },
];

export const processSteps = [
  { title: "زيارة ودراسة", text: "مهندس بيزور الموقع وبيقيس السطح والاستهلاك. مجانية داخل عمّان." },
  { title: "عرض السعر", text: "بتوصلك تفاصيل النظام والسعر النهائي وطريقة الدفع." },
  { title: "التركيب", text: "من 2 لـ 4 أيام للبيوت، ومن 2 لـ 6 أسابيع للمصانع." },
  { title: "الربط مع الكهربا", text: "بنخلص معاملة الربط مع شركة الكهربا عنك، وبتاخذ حوالي 3 أسابيع." },
];

export const offers = [
  { key: "home_discount", title: "خصم 10%", text: "على أنظمة البيوت لحد آخر الشهر." },
  { key: "free_cleaning", title: "تنظيف مجاني سنتين", text: "مع أي نظام جديد." },
  { key: "students_teachers", title: "5% إضافي", text: "لطلاب الجامعات والمعلمين." },
];

export const branches = [
  { key: "amman", title: "الفرع الرئيسي، عمّان", address: "شارع المدينة المنورة، عمارة 120، الطابق الثالث", hours: "الأحد للخميس 8:00 لـ 5:00، والسبت 9:00 لـ 2:00" },
  { key: "irbid", title: "فرع إربد", address: "شارع الجامعة، مقابل بوابة جامعة اليرموك", hours: "الأحد للخميس 8:00 لـ 5:00" },
  { key: "aqaba", title: "فرع العقبة", address: "المنطقة التجارية، شارع الكورنيش", hours: "الأحد للخميس 8:00 لـ 5:00" },
];
export const hoursNote = "الجمعة عطلة.";

export const contact = {
  phone: "06 555 1234",
  whatsapp: "0790 000 111",
  email: "info@alhayat-energy.example",
};

export const faq = [
  { key: "savings", q: "قديش بوفّر النظام من فاتورة الكهربا؟", a: "بالعادة بين 70% و 95%، حسب حجم النظام واستهلاك البيت." },
  { key: "payback", q: "بعد قديش النظام بيرجّع حقه؟", a: "بالمتوسط بين 3 و 5 سنين." },
  { key: "winter", q: "شو بصير بالشتا أو بالأيام الغيم؟", a: "النظام بيضل ينتج كهربا بس أقل، والبيت بياخذ الباقي من الشبكة تلقائياً." },
  { key: "cleaning", q: "هل لازم أنظّف الألواح؟", a: "يفضّل كل شهرين أو تلاتة، خصوصاً بعد الغبار." },
  { key: "coverage", q: "هل بتشتغلوا خارج عمّان؟", a: "آه، بنغطي كل محافظات المملكة. الزيارة مجانية داخل عمّان و 15 دينار خارجها." },
];

export const about = {
  text: "شركة أردنية تأسست سنة 2015 بعمّان. بنصمّم ونركّب ونصين أنظمة الطاقة الشمسية للبيوت والمصانع والمزارع، وفريقنا 85 موظف بإدارة المهندس سامر الخطيب.",
  mission: "نوصّل الطاقة الشمسية لكل بيت بسعر معقول وجودة عالية.",
  stats: [
    { value: "3,000+", label: "نظام بيتي" },
    { value: "120", label: "مشروع تجاري" },
    { value: "45", label: "ميغاواط مركّبة" },
  ],
};

export const sectionsNav = [
  { id: "services", label: "الخدمات" },
  { id: "prices", label: "الأسعار" },
  { id: "warranty", label: "الكفالة" },
  { id: "process", label: "كيف نشتغل" },
  { id: "branches", label: "الفروع" },
  { id: "faq", label: "أسئلة شائعة" },
  { id: "contact", label: "تواصل" },
];
