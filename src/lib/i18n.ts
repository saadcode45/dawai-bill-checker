// All patient-facing strings in both languages.
// 'ur' = Urdu script, 'roman' = Roman Urdu (Latin letters).
// Every prompt the user specified exists in both.

export type Lang = "ur" | "roman";

export const STRINGS = {
  appName: { ur: "دوائی بل چیکر", roman: "Dawai Bill Checker" },
  tagline: {
    ur: "دوائی لینے سے پہلے بل معلوم کریں",
    roman: "Dawai lene se pehle bill maloom karein",
  },
  chooseLanguage: {
    ur: "زبان منتخب کریں",
    roman: "Zubaan muntakhab karein",
  },
  scanOrType: {
    ur: "پرچی کی تصویر اپ لوڈ کریں یا دوائی کا نام لکھیں",
    roman: "Parchi ki tasveer upload karein ya dawai ka naam likhein",
  },
  uploadSlip: { ur: "پرچی کی تصویر اپ لوڈ کریں", roman: "Parchi ki tasveer upload karein" },
  typeNames: { ur: "دوائی کے نام لکھیں", roman: "Dawai ke naam likhein" },
  takePhoto: { ur: "تصویر لیں", roman: "Tasveer lein" },
  readingSlip: {
    ur: "پرچی پڑھی جا رہی ہے… براہ کرم انتظار کریں",
    roman: "Parchi parhi ja rahi hai… barah-e-karam intezar karein",
  },
  confirmTitle: {
    ur: "براہ کرم چیک کریں — کیا یہ درست ہے؟",
    roman: "Barah-e-karam check karein — kya ye durust hai?",
  },
  confirmNote: {
    ur: "غلط نام یا دن ہو تو درست کر دیں، پھر بل دیکھیں",
    roman: "Ghalat naam ya din ho to durust kar dein, phir bill dekhein",
  },
  medicine: { ur: "دوائی", roman: "Dawai" },
  dose: { ur: "خوراک", roman: "Khurak" },
  days: { ur: "دن", roman: "Din" },
  qty: { ur: "تعداد", roman: "Tadad" },
  price: { ur: "قیمت", roman: "Qeemat" },
  packs: { ur: "پیک", roman: "Pack" },
  total: { ur: "کل بل", roman: "Kul Bill" },
  showBill: { ur: "بل دیکھیں", roman: "Bill dekhein" },
  addMedicine: { ur: "دوائی شامل کریں", roman: "Dawai shamil karein" },
  remove: { ur: "ہٹائیں", roman: "Hatayein" },
  sameDaysForAll: {
    ur: "سب دوائیوں کے دن ایک جیسے ہیں",
    roman: "Sab dawaiyon ke din aik jaise hain",
  },
  daysForAll: { ur: "سب کے دن", roman: "Sab ke din" },
  estimateNote: {
    ur: "یہ ایک اندازہ ہے۔ اصل بل کاؤنٹر پر ہوگا۔",
    roman: "Ye aik andaza hai. Asal bill counter par hoga.",
  },
  priceNotSet: {
    ur: "قیمت ابھی نہیں لگی",
    roman: "Qeemat abhi nahi lagi",
  },
  notFound: {
    ur: "اس فارمیسی میں نہیں ہے",
    roman: "Is pharmacy mein nahi hai",
  },
  budgetQuestion: {
    ur: "آپ کتنے پیسے کی دوائی لینا چاہتے ہیں؟ میں اس حساب سے بل بنا دیتا ہوں",
    roman: "Aap kitne paisay ki dawai lena chahte hain? Main us hisab se bill bana deta hoon",
  },
  yourBudget: { ur: "آپ کا بجٹ (روپے)", roman: "Aap ka budget (Rs)" },
  adjustQuestion: {
    ur: "دوائی کم دن کی کر دوں یا کچھ دوائی نکال دوں بیچ میں سے؟",
    roman: "Dawai kam din ki kar dun ya kuch dawai nikal dun beech mein se?",
  },
  fewerDays: { ur: "کم دن کی کر دوں", roman: "Kam din ki kar dun" },
  removeSome: { ur: "کچھ دوائی نکال دوں", roman: "Kuch dawai nikal dun" },
  newBill: { ur: "نیا بل", roman: "Naya Bill" },
  whatChanged: { ur: "کیا تبدیل ہوا", roman: "Kya tabdeel hua" },
  daysReducedTo: {
    ur: "دن کم کر دیے گئے",
    roman: "Din kam kar diye gaye",
  },
  removedMedicines: {
    ur: "یہ دوائیاں نکال دی گئیں",
    roman: "Ye dawaiyan nikal di gayein",
  },
  showToPharmacy: {
    ur: "اب یہ بل فارمیسی والے کو دکھا دیں یا اسے بتا دیں کہ (4 دن / جو دوائی کم کی ہے) یہ چاہیے",
    roman: "Ab ye bill pharmacy waly ko dikha dein ya usay bata dein ke (4 din / jo dawai kam ki hai) ye chahiye",
  },
  back: { ur: "واپس", roman: "Wapas" },
  next: { ur: "آگے", roman: "Aagay" },
  startAgain: { ur: "دوبارہ شروع کریں", roman: "Dobara shuru karein" },
  noMedicinesYet: {
    ur: "اس فارمیسی نے ابھی دوائیاں شامل نہیں کیں",
    roman: "Is pharmacy ne abhi dawaiyan shamil nahi kein",
  },
  couldNotRead: {
    ur: "پرچی صاف نہیں پڑھی جا سکی۔ براہ کرم نام خود لکھیں۔",
    roman: "Parchi saaf nahi parhi ja saki. Barah-e-karam naam khud likhein.",
  },
  enterBudget: {
    ur: "بجٹ لکھیں",
    roman: "Budget likhein",
  },
  keep: { ur: "رکھیں", roman: "Rakhein" },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[key][lang];
}
