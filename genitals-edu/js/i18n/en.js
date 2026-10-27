/**
 * English Language Translations & Educational Content
 */
export const en = {
  pageTitle: "External Genital Homology & Morphogenesis: Embryology to Adult & Physiological Response",
  brandTitle: "External Genital Homology & Morphogenesis",
  brandSub: "Embryonic primordium (Week 7) &rarr; Neonatal &rarr; Adult maturation &amp; Arousal response",
  clayBtn: "Sculpted Clay",
  clayBtnShort: "Clay",
  clayTitle: "Sculpted Clay (Stylized/Tactile)",
  atlasBtn: "Clinical Atlas",
  atlasBtnShort: "Atlas",
  atlasTitle: "Clinical Atlas (Realistic/Medical Diagram)",
  advBtn: "Advanced Development",
  advTitle: "Toggle Adult Maturation & Arousal (A)",
  labelsBtn: "Labels",
  labelsTitle: "Labels (L)",
  resetBtn: "Reset view",
  resetTitle: "Reset view",
  guideBtn: "Guide",
  guideTitle: "Educational Guide & Homology (I)",
  glError: "Failed to load three.js. Check your internet connection and reload.",
  legendTitle: "Embryological Origin",
  legendHint: "Hover / click to trace homologues",
  btnPlayTitle: "Play / Pause (Space)",
  btnLoopTitle: "Continuous loop",
  scrubberLabel: "Developmental timeline scrubber",
  arousalTitle: "Physiological Vasocongestion & Tumescence (Arousal)",
  arousalResting: "Resting (Flaccid)",
  arousalPeak: "Peak Vasocongestion (Erect)",
  arousalPreset0: "Resting (0%)",
  arousalPreset50: "Plateau (50%)",
  arousalPreset100: "Peak Arousal (100%)",
  arousalPulsePlay: "\u25B6 Auto Pulse",
  arousalPulseStop: "\u25A0 Stop Pulse",
  arousalPulseTitle: "Animate physiological cycle",
  arousalBadgeResting: "Resting / Flaccid (0%)",
  arousalBadgeMalePlat: pct => `Tumescent / Engorging (${pct}%)`,
  arousalBadgeMalePeak: pct => `Peak Rigid Erection (${pct}%)`,
  arousalBadgeFemalePlat: pct => `Plateau Vasocongestion (${pct}%)`,
  arousalBadgeFemalePeak: pct => `Peak Arousal \u00b7 Parted Labia Minora (${pct}%)`,
  panelBadge: "Interactive Guide",
  panelTitle: "Embryological Organogenesis & Homology",
  collapseAll: "Collapse All",
  expandAll: "Expand All",
  closeGuide: "Close guide (Esc)",
  panelDesc: "Comprehensive comparative anatomy of human external genitalia: primordial origins, sex steroid-driven differentiation, pubertal maturation, and neurovascular arousal physiology displayed in standard lithotomy clinical examination posture.",
  matrixTitle: "Anatomical Homology Matrix",
  matrixHint: "Click any row to isolate and trace that tissue across all developmental stages.",
  thTissue: "Tissue",
  thS0: "Week 7",
  thFemale: "Female",
  thMale: "Male",
  originsTitle: "Tissue Origins & Adult Derivatives",
  adultHomologuesLabel: "Adult Homologues:",
  femaleLabel: "female",
  maleLabel: "male",
  endocrineTitle: "Endocrine Drivers (SRY \u2192 DHT)",
  endocrineSteps: [
    { num: "1. SRY", text: "on the Y chromosome (Yp11.2) triggers testis determination (Sertoli &amp; Leydig cells).", cls: "" },
    { num: "2. Fetal Testosterone.", text: "Secreted by Leydig cells beginning Week 8.", cls: "" },
    { num: "3. 5&alpha;-reductase type 2", text: "converts testosterone locally to <strong>dihydrotestosterone (DHT)</strong>.", cls: "" },
    { num: "4. Androgen receptor signalling.", text: "Drives phallic elongation, ventral fold fusion (penile raphe/spongy urethra), and scrotal swelling fusion.", cls: "" },
    { num: "5. Absence of DHT (46,XX).", text: "Yields default female morphology: glans clitoridis, unfused labia minora, labia majora, and patent vestibule.", cls: "f" }
  ],
  pubertalTitle: "Pubertal Maturation & Sexual Response",
  pubertalSteps: [
    {
      lead: "Pubertal Steroid Surge.",
      body: "Hypothalamic GnRH stimulates pituitary LH/FSH. In 46,XX, ovarian estrogens expand labial adipose, clitoral vascularity, and vaginal lubrication. In 46,XY, testicular testosterone/DHT expands penile corpora, glans volume, and scrotal dartos rugae.",
      cls: "p"
    },
    {
      lead: "Parasympathetic Erection & Vasocongestion (S2&ndash;S4).",
      body: "Pelvic splanchnic nerves release <strong>Nitric Oxide (NO)</strong> &rarr; soluble guanylyl cyclase &rarr; <strong>cGMP</strong> &rarr; smooth muscle relaxation of helicine arterioles.<br>&bull; <em>Male:</em> Cavernosal spaces engorge; subtunical venules compress against tunica albuginea (veno-occlusive mechanism), producing rigid erection (+55% length, +35% girth). Scrotum contracts and ascends.<br>&bull; <em>Female:</em> Clitoral corpora and vestibular bulbs engorge; labia minora swell, blush, and <strong>part laterally</strong> to reveal the vaginal introitus; labia majora flatten slightly; epithelial transudation produces lubrication.",
      cls: "p"
    },
    {
      lead: "Sympathetic Resolution (T11&ndash;L2).",
      body: "Norepinephrine &rarr; vasoconstriction &rarr; PDE5 degrades cGMP &rarr; detumescence back to resting flaccid state.",
      cls: ""
    }
  ],
  clinicalTitle: "Clinical Correlates",
  clinicalItems: [
    { head: "Hypospadias", text: "Incomplete ventral fusion of urethral folds leaves the urethral meatus proximal on the ventral shaft." },
    { head: "Androgen Insensitivity Syndrome (CAIS)", text: "46,XY individuals with non-functional AR exhibit female-typical external anatomy despite intra-abdominal testes." },
    { head: "5&alpha;-Reductase Type 2 Deficiency", text: "Impaired conversion of T to DHT causes under-virilized neonatal genitalia, often with significant virilization at puberty under high testosterone." },
    { head: "Congenital Adrenal Hyperplasia (46,XX)", text: "Adrenal androgen excess virilizes female external genitalia (clitoromegaly and partial labioscrotal fusion)." }
  ],
  notice: "Educational anatomical simulation based on classical embryology (Langman) and human sexual neurovascular physiology (Masters &amp; Johnson / Guyton &amp; Hall).",
  stagesStd: [
    { t: 0, label: "Week 7 Bipotential", tick: "W7" },
    { t: 0.3333, label: "Female Homology (46,XX)", tick: "\u2640 46,XX" },
    { t: 0.6667, label: "Male Homology (46,XY)", tick: "\u2642 46,XY" },
    { t: 1.0, label: "Return to W7", tick: "W7 \u21BA" }
  ],
  stagesAdv: [
    { t: 0, label: "W7 Primordium", tick: "W7" },
    { t: 0.25, label: "\u2640 Neonatal", tick: "\u2640 Neo" },
    { t: 0.50, label: "\u2640 Adult Maturation", tick: "\u2640 Adult" },
    { t: 0.75, label: "\u2642 Neonatal", tick: "\u2642 Neo" },
    { t: 1.00, label: "\u2642 Adult Maturation", tick: "\u2642 Adult" }
  ],
  stageMeta: {
    s0Title: "Bipotential primordial genitalia (Gestational Week 7)",
    s0Sub: "Gestational Week 7 \u00b7 Bipotential primordium",
    s0SubStd: "Gestational Week 7 \u00b7 Indifferent stage",
    femaleNeoTitle: "Female Phenotypic Differentiation (46,XX Neonatal)",
    femaleNeoSub: "Week 12+ \u00b7 Female differentiation (default pathway)",
    femaleNeoSubStd: "Week 12+ \u00b7 Default 46,XX phenotypic pathway",
    femaleAdultTitle: "Adult Female Genital Anatomy (Post-Pubertal)",
    femaleAdultSub: "Post-pubertal \u00b7 Mature estrogen-primed anatomy",
    maleNeoTitle: "Male Phenotypic Differentiation (46,XY Neonatal)",
    maleNeoSub: "Week 12+ \u00b7 DHT-driven ventral fusion & elongation",
    maleNeoSubStd: "Week 12+ \u00b7 Androgen-mediated 46,XY pathway",
    maleAdultTitle: "Adult Male Genital Anatomy (Post-Pubertal)",
    maleAdultSub: "Post-pubertal \u00b7 Mature testosterone-primed anatomy"
  },
  infoLabels: {
    w7: "Week 7",
    female: "Female",
    male: "Male"
  },
  arousalLabels: {
    partedLabia: "Parted / Engorged Labia Minora",
    tumescentClitoris: "Tumescent Clitoris",
    erectPenis: "Erect Glans & Shaft",
    patentVestibule: "Exposed Patent Vestibule"
  },
  tissues: {
    genitalTubercle: {
      name: "Genital Tubercle",
      s0: "Primordial phallus",
      femaleNeo: "Glans clitoridis & prepuce",
      femaleAdult: "Glans clitoridis (erectile)",
      maleNeo: "Glans penis & shaft",
      maleAdult: "Glans penis & shaft (erectile corpora)",
      desc: "Midline phallic precursor cranial to the urogenital membrane. In females it forms the glans clitoridis and hood; in males under DHT it elongates into the penile shaft (paired corpora cavernosa) and glans penis."
    },
    urogenitalFolds: {
      name: "Urogenital / Urethral Folds",
      s0: "Unfused medial folds",
      femaleNeo: "Labia minora",
      femaleAdult: "Labia minora (vascular folds)",
      maleNeo: "Ventral penile raphe & spongy urethra",
      maleAdult: "Ventral penile raphe & penile urethra",
      desc: "Paired medial folds flanking the urogenital groove. In females they remain unfused as the delicate, vascular labia minora that part during arousal; in males they fuse ventrally along the penile raphe to enclose the spongy urethra."
    },
    labioscrotalSwellings: {
      name: "Labioscrotal / Genital Swellings",
      s0: "Lateral genital swellings",
      femaleNeo: "Labia majora",
      femaleAdult: "Labia majora (cutaneous adipose cushions)",
      maleNeo: "Scrotum & scrotal raphe",
      maleAdult: "Scrotal sac & dartos rugae",
      desc: "Paired lateral swellings. In females they develop into the labia majora meeting at the commissures; in males they migrate inferomedially and fuse into the bilobate scrotal sac with median raphe."
    },
    urogenitalSinus: {
      name: "Urogenital Sinus / Vestibule",
      s0: "Urogenital groove",
      femaleNeo: "Vestibule (urethral & vaginal orifices)",
      femaleAdult: "Vestibule, urethral papilla & vaginal introitus",
      maleNeo: "Spongy (penile) urethra lumen",
      maleAdult: "Spongy urethra & external urethral meatus",
      desc: "Central groove and endodermal sinus. In females it broadens into the vestibule containing the external urethral orifice and vaginal introitus; in males fold fusion closes it over to form the lumen of the spongy urethra."
    }
  }
};
