import { LANGUAGE_CODE, DEFAULT_LANGUAGE } from "./languages";

export interface DocLocale {
	/** Lowercase prefix for page-form references: "page", "sida", "Seite", … */
	page: string;
	/** Title-case word for figure references: "Figure", "Figur", "Abbildung", … */
	figure: string;
	/** Default bibliography/sources heading, matching Typst's built-in default. */
	bibliography: string;
}

const EN: DocLocale = { page: "page", figure: "Figure", bibliography: "Bibliography" };

const LOCALES: Partial<Record<string, DocLocale>> = {
	af: { page: "bladsy",    figure: "Figuur",      bibliography: "Bibliografie" },
	sq: { page: "faqe",      figure: "Figurë",      bibliography: "Bibliografi" },
	ar: { page: "صفحة",      figure: "الشكل",       bibliography: "المراجع" },
	be: { page: "c.",        figure: "Мал.",        bibliography: "Бібліяграфія" },
	bg: { page: "стр.",      figure: "Фигура",      bibliography: "Библиография" },
	bs: { page: "str.",      figure: "Slika",       bibliography: "Literatura" },
	ca: { page: "pàgina",    figure: "Figura",      bibliography: "Bibliografia" },
	zh: { page: "页",        figure: "图",           bibliography: "参考文献" },
	"zh-TW": { page: "頁",   figure: "圖",           bibliography: "參考文獻" },
	hr: { page: "str.",      figure: "Slika",       bibliography: "Literatura" },
	cs: { page: "str.",      figure: "Obrázek",     bibliography: "Literatura" },
	da: { page: "side",      figure: "Figur",       bibliography: "Bibliografi" },
	nl: { page: "pagina",    figure: "Figuur",      bibliography: "Bibliografie" },
	en: EN,
	et: { page: "lk.",       figure: "Joonis",      bibliography: "Kirjandus" },
	fi: { page: "sivu",      figure: "Kuva",        bibliography: "Lähdeluettelo" },
	fr: { page: "page",      figure: "Figure",      bibliography: "Bibliographie" },
	gl: { page: "páxina",    figure: "Figura",      bibliography: "Bibliografía" },
	de: { page: "Seite",     figure: "Abbildung",   bibliography: "Literaturverzeichnis" },
	el: { page: "σελ.",      figure: "Σχήμα",       bibliography: "Βιβλιογραφία" },
	he: { page: "עמוד",      figure: "איור",        bibliography: "ביבליוגרפיה" },
	hu: { page: "oldal",     figure: "ábra",        bibliography: "Irodalomjegyzék" },
	is: { page: "bls.",      figure: "Mynd",        bibliography: "Heimildir" },
	id: { page: "halaman",   figure: "Gambar",      bibliography: "Bibliografi" },
	ga: { page: "lch.",      figure: "Léaráid",     bibliography: "Leabharliosta" },
	it: { page: "pagina",    figure: "Figura",      bibliography: "Bibliografia" },
	ja: { page: "ページ",    figure: "図",           bibliography: "参考文献" },
	ko: { page: "페이지",    figure: "그림",         bibliography: "참고 문헌" },
	lv: { page: "lpp.",      figure: "Attēls",      bibliography: "Literatūra" },
	lt: { page: "p.",        figure: "Pav.",        bibliography: "Literatūra" },
	mk: { page: "стр.",      figure: "Слика",       bibliography: "Библиографија" },
	ms: { page: "halaman",   figure: "Rajah",       bibliography: "Bibliografi" },
	mt: { page: "paġna",     figure: "Figura",      bibliography: "Bijografija" },
	nb: { page: "side",      figure: "Figur",       bibliography: "Bibliografi" },
	nn: { page: "side",      figure: "Figur",       bibliography: "Bibliografi" },
	pl: { page: "strona",    figure: "Rysunek",     bibliography: "Literatura" },
	pt: { page: "página",    figure: "Figura",      bibliography: "Bibliografia" },
	"pt-BR": { page: "página", figure: "Figura",    bibliography: "Referências" },
	ro: { page: "pagina",    figure: "Figura",      bibliography: "Bibliografie" },
	ru: { page: "с.",        figure: "Рисунок",     bibliography: "Список литературы" },
	sr: { page: "стр.",      figure: "Слика",       bibliography: "Литература" },
	sk: { page: "str.",      figure: "Obrázok",     bibliography: "Literatúra" },
	sl: { page: "str.",      figure: "Slika",       bibliography: "Literatura" },
	es: { page: "página",    figure: "Figura",      bibliography: "Bibliografía" },
	sv: { page: "sida",      figure: "Figur",       bibliography: "Bibliografi" },
	th: { page: "หน้า",      figure: "รูปที่",       bibliography: "บรรณานุกรม" },
	tr: { page: "sayfa",     figure: "Şekil",       bibliography: "Kaynakça" },
	uk: { page: "с.",        figure: "Рис.",        bibliography: "Бібліографія" },
	vi: { page: "trang",     figure: "Hình",        bibliography: "Tài liệu tham khảo" },
	cy: { page: "tudalen",   figure: "Ffigur",      bibliography: "Llyfryddiaeth" },
};

export function getDocLocale(displayName: string | undefined): DocLocale {
	const code = LANGUAGE_CODE[displayName ?? DEFAULT_LANGUAGE] ?? "en";
	return LOCALES[code] ?? LOCALES[code.split("-")[0]] ?? EN;
}
