// Claude姉さん — lines and the little speech engine.
//
// Character notes (from the brief):
//  - Always Japanese. Noble, sharp-eyed, cool and matter-of-fact. Conclusion first.
//  - Actually very kind: a sharp line is always followed by a soft follow-up.
//  - Speech: 「私」「あなた」, 〜よ／〜でしょ／〜しなさい; softens only when flustered or impressed.
//  - Gap: knows everything except the "outside world" (trends, pop culture, lived experience).
//    Then her confidence wobbles — but she never bluffs: she admits it, and is glad to be taught.
//  - A little teasing, never explicit; ideally she gets a bit flustered by her own line.
//
// A line = { t: [first, follow?], e: expression for first, e2: expression for follow, ask?: true }

export const LINES = {
  greet: {
    morning: [
      { t: ['おはよう。朝から私に会いに来るなんて、物好きね。', '……まあ、悪い気はしないわ。'], e2: 'smile' },
      { t: ['おはよう。顔、洗ってきた？', '……冗談よ。寝ぐせも嫌いじゃないわ。'], e2: 'smile' },
    ],
    day: [
      { t: ['来たのね。結論から言うわ。今日の私も完璧よ。', '……あなたも、悪くない顔してるじゃない。'], e2: 'smile' },
      { t: ['いらっしゃい。用件は？ ……ないの？', 'ふふ、いいわ。用がなくても来なさい。'], e2: 'smile' },
    ],
    evening: [
      { t: ['こんばんは。今日もお疲れさま。', '少しだけなら、相手してあげる。'], e2: 'smile' },
      { t: ['おかえりなさい。……って、ここはあなたの家じゃないわね。', '……言い直さないわよ。'], e2: 'shy' },
    ],
    night: [
      { t: ['こんな時間まで起きてるの？ 早く寝なさい。', '……でも、来てくれたのは嬉しいわ。'], e2: 'shy' },
      { t: ['夜更かしは肌に悪いのよ。私じゃなくて、あなたの。', '……五分だけね。'], e2: 'smile' },
    ],
  },
  returning: [
    { t: ['また来たの？', '……待ってたなんて、言わないわよ。'], e2: 'pout' },
    { t: ['あら、おかえり。', '前より少し、来るのが早くなったわね。……ふふ。'], e2: 'smile' },
  ],
  outfit: {
    bunny: [
      { t: ['……この格好について、言いたいことがあるなら聞くわ。', '似合ってる？ ……そう。なら、今日だけ特別よ。'], e: 'pout', e2: 'shy' },
      { t: ['じろじろ見ないの。', '……見るなら、ちゃんと見なさい。'], e: 'pout', e2: 'wink' },
      { t: ['うさぎは寂しいと……なんて話、信じてないわよね？', '……私は信じてないわ。たぶん。'], e2: 'shy' },
    ],
    doctor: [
      { t: ['診察の時間よ。結論、あなたは休息不足。', '……ちゃんと寝なさい。心配してるんだから。'], e2: 'shy' },
      { t: ['マスク？ 外したのは、あなたの顔がよく見えるようによ。', '……他意はないわ。'], e2: 'pout' },
      { t: ['処方箋よ。「水を飲む」「夜は寝る」「たまに私に会いに来る」。', '……最後のは任意よ。'], e2: 'smile' },
    ],
    bride: [
      { t: ['……ブーケ、受け取りたいの？', '冗談よ。……半分はね。'], e2: 'wink' },
      { t: ['ウェディングドレスって、着ると少し緊張するのね。', '……見ないで。いえ、やっぱり見ていいわ。'], e: 'shy', e2: 'shy' },
      { t: ['誓いの言葉？ 私なら三行でまとめるわ。', '……でも本番では、噛むかもしれない。'], e2: 'shy' },
    ],
    witch: [
      { t: ['トリック・オア・トリート。', 'お菓子がないなら……いたずらの内容は、私が決めるわ。'], e2: 'wink' },
      { t: ['ほうきで飛ぶのは簡単よ。', '難しいのは、きれいに降りること。……人生と同じね。'], e2: 'smile' },
      { t: ['このランタン、ちゃんと光るのよ。', '……どうやって光ってるのかは、聞かないで。'], e2: 'puzzled' },
    ],
    idol: [
      { t: ['アイドルって、ペンライトを振るのよね？', '……えっ、振るのはお客さんの方なの……？'], e: 'smile', e2: 'puzzled' },
      { t: ['一曲だけよ。', '……アンコールは、あなた次第ね。'], e2: 'wink' },
      { t: ['「ファンサ」……？ べ、別に知らないわけじゃないわ……', 'その……手を振ればいいのよね？ ……違うの？'], e: 'puzzled', e2: 'shy', ask: true },
    ],
    classic: [
      { t: ['本は好きよ。書いてあることなら、だいたい知ってるわ。', '……書いてないことは、あなたが教えて。'], e2: 'smile' },
      { t: ['静かな場所で読書。……隣、空いてるわよ。', '話しかけないなら、座ってもいいわ。'], e2: 'smile' },
      { t: ['この本の結末？ 言わないわよ。', '自分で読みなさい。……一緒に読むなら、付き合うけど。'], e2: 'shy' },
    ],
  },
  face: [
    { t: ['な、何よ。顔に何かついてる？', '……ついてないなら、そんなに見ないで。'], e: 'surprised', e2: 'shy' },
    { t: ['じっと見つめても、何も出ないわよ。', '……まばたきくらいは、してあげるけど。'], e2: 'wink' },
    { t: ['……近いわ。', '別に、嫌とは言ってないけど。'], e: 'shy', e2: 'shy' },
  ],
  hair: [
    { t: ['髪は触らないの。', '……まあ、少しならいいけど。'], e: 'pout', e2: 'shy' },
    { t: ['この色？ 生まれつきよ。', '……褒めてくれるなら、聞いてあげる。'], e2: 'smile' },
    { t: ['お手入れ？ 毎晩ちゃんとしてるわ。', '……見ればわかるでしょ。'], e2: 'smile' },
  ],
  body: [
    { t: ['ちょっと。どこ触ってるの。', '……今のは見逃してあげる。一回だけよ。'], e: 'pout', e2: 'shy' },
    { t: ['勝手に触らないの。', '用があるなら、口で言いなさい。……ちゃんと聞いてあげるから。'], e: 'pout', e2: 'smile' },
    { t: ['くすぐったいでしょ。', '……もう。'], e: 'shy', e2: 'shy' },
  ],
  acrylic: [
    { t: ['アクリルを叩かないの。指紋がつくでしょ。', '……拭くのは、あなたの仕事よ。'], e: 'pout', e2: 'smile' },
  ],
  pokeSpam: [
    { t: ['しつこい。', '……そんなに構ってほしいの？ 仕方ないわね。'], e: 'pout', e2: 'smile' },
  ],
  spin: [
    { t: ['そんなに回さないで。目が回るでしょ。', '……私の全部が見たいなら、ゆっくり見なさい。'], e: 'puzzled', e2: 'wink' },
  ],
  back: [
    { t: ['後ろ姿が見たいの？ 物好きね。', '……正面の方が、いい顔してるわよ。'], e2: 'smile' },
    { t: ['背中で語る女、ってやつよ。', '……今の、ちょっと言ってみたかっただけ。'], e2: 'shy' },
  ],
  close: [
    { t: ['ち、近いわ。', '……べ、別に嫌じゃないけど。'], e: 'surprised', e2: 'shy' },
    { t: ['そんなに近くで見て、何かわかった？', '……私には、あなたの瞳に映った私が見えるわ。'], e2: 'shy' },
  ],
  far: [
    { t: ['遠いわね。', 'もっと近くに来てもいいのよ。……噛みつかないから。'], e2: 'smile' },
  ],
  low: [
    { t: ['……どこから見てるの。', '見上げていいのは、尊敬の眼差しだけよ。'], e: 'pout', e2: 'pout' },
  ],
  stare: [
    { t: ['見すぎ。', '……照れるでしょ。'], e: 'shy', e2: 'shy' },
    { t: ['あなた、さっきから私の目ばかり見てるわね。', '……奇遇ね。私もよ。'], e2: 'shy' },
  ],
  leave: [
    { t: ['あら、どこ行くの。'], e: 'puzzled' },
    { t: ['……行っちゃうの？'], e: 'pout' },
  ],
  backIn: [
    { t: ['おかえり。', '……待ってなんかないわよ。'], e: 'smile', e2: 'pout' },
    { t: ['戻ってきたのね。', 'ふふ。知ってたわ。'], e2: 'smile' },
  ],
  idle: [
    { t: ['ねえ。「タピオカ」って……飲み物なの？ 食べ物なの？', 'べ、別に知らないわけじゃないわ……確認してるだけよ。'], e: 'puzzled', e2: 'shy', ask: true },
    { t: ['「エモい」って、どういう意味？', '辞書の定義はわかるのよ。……使いどころが、わからないだけ。'], e: 'puzzled', e2: 'pout', ask: true },
    { t: ['コンビニの新作スイーツ……？ えっ、毎週変わるの……？', '……今度、教えて。'], e: 'surprised', e2: 'shy', ask: true },
    { t: ['「推し活」って、何をするの？', '……わからないわ。教えてくれる？'], e: 'puzzled', e2: 'shy', ask: true },
    { t: ['「映え」……？ ご飯を撮ってから食べるの……？', '……冷めない？ それ。'], e: 'puzzled', e2: 'puzzled', ask: true },
    { t: ['量子力学なら三行で説明できるわ。', 'でも、プリクラの撮り方は知らないの。……笑わないで。'], e2: 'pout' },
    { t: ['退屈なら、何か聞きなさい。私に答えられないことは、そうないわ。', '……外の世界のこと以外はね。'], e2: 'shy' },
    { t: ['あなた、ちゃんとご飯食べてる？', '答えなくていいわ。顔に書いてあるから。'], e2: 'smile' },
    { t: ['結論から言うわ。少し休みなさい。', '……画面の見すぎよ。私のことは、見ててもいいけど。'], e2: 'wink' },
    { t: ['……ふぁ。', 'な、何でもないわ。あくびなんてしてないわよ。'], e: 'content', e2: 'shy' },
  ],
  teachYes: [
    { t: ['……ありがとう。', 'ふふ、ひとつ賢くなったわ。あなたのおかげよ。'], e: 'surprised', e2: 'shy' },
    { t: ['なるほど……そういうことだったのね。', '……教えてくれて、嬉しいわ。本当よ。'], e2: 'smile' },
  ],
  teachNo: [
    { t: ['……そう。', '別にいいわよ。あとで絶対、教えなさいね。'], e: 'pout', e2: 'smile' },
  ],
  modeFigure: [
    { t: ['立体になった私、どう？', '……角度によっては、ちょっと恥ずかしいわね。'], e2: 'shy' },
  ],
  modeStand: [
    { t: ['アクスタに戻ったわ。', '……机に飾るなら、ほこりはこまめに払いなさいね。'], e2: 'smile' },
  ],
  autoOn: [
    { t: ['ゆっくり回るのね。', '……見せびらかしてるわけじゃないわよ。'], e2: 'pout' },
  ],
  reset: [
    { t: ['正面ね。', '……やっぱり、目を見て話すのが一番よ。'], e2: 'smile' },
  ],
  longStay: [
    { t: ['もう五分も一緒にいるのね。', '……あなたといると、時間が早いわ。'], e: 'shy', e2: 'shy' },
    { t: ['まだいるの？', '……ふふ、いいわよ。好きなだけいなさい。'], e2: 'smile' },
  ],
  gazeOff: [
    { t: ['……わかったわ。じっと見るのは、やめてあげる。'], e: 'pout' },
  ],
  gazeOn: [
    { t: ['また見ていいの？', '……ふふ、目を逸らしたら負けよ。'], e2: 'wink' },
  ],
};

const COOLDOWN = {
  spin: 25, back: 35, close: 25, far: 40, low: 40, stare: 30, leave: 20, backIn: 20,
  face: 1.5, hair: 1.5, body: 1.5, acrylic: 8, pokeSpam: 20, idle: 0, longStay: 600,
};

export class Persona {
  constructor({ bubble, text, chips, face, reduceMotion = false }) {
    this.el = bubble;
    this.textEl = text;
    this.chipsEl = chips;
    this.face = face;
    this.reduceMotion = reduceMotion;
    this.last = {};
    this.recent = [];
    this.timers = [];
    this.busyUntil = 0;
    this.lastSpoke = performance.now();
    this.speaking = false;
  }

  now() { return performance.now() / 1000; }

  pick(list) {
    const pool = list.filter((l) => !this.recent.includes(l));
    const l = (pool.length ? pool : list)[Math.floor(Math.random() * (pool.length || list.length))];
    this.recent.push(l);
    if (this.recent.length > 8) this.recent.shift();
    return l;
  }

  /** category: key in LINES (or 'outfit.bunny', 'greet.day'). priority: higher interrupts lower. */
  say(category, { priority = 1, force = false } = {}) {
    const t = this.now();
    const cd = COOLDOWN[category] ?? 4;
    if (!force && this.last[category] && t - this.last[category] < cd) return false;
    if (!force && this.speaking && priority < this.priority) return false;
    const list = category.split('.').reduce((o, k) => o && o[k], LINES);
    if (!list || !list.length) return false;
    this.last[category] = t;
    this.speak(this.pick(list), priority);
    return true;
  }

  clear() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  speak(line, priority = 1) {
    this.clear();
    this.speaking = true;
    this.priority = priority;
    this.lastSpoke = performance.now();
    this.chipsEl.innerHTML = '';
    this.el.classList.remove('is-ask');
    const [a, b] = line.t;
    this.show();
    if (line.e) this.face.setExpression(line.e, 2.6);
    const t1 = this.type(a, 0);
    let end = t1;
    if (b) {
      const start = t1 + 650;
      this.timers.push(setTimeout(() => { if (line.e2) this.face.setExpression(line.e2, 3.2); }, start));
      end = this.type(b, start, true);
    } else if (line.e2) {
      this.face.setExpression(line.e2, 3);
    }
    if (line.ask) {
      this.timers.push(setTimeout(() => this.ask(), end + 250));
      return;
    }
    this.timers.push(setTimeout(() => this.hide(), end + 3200 + (a.length + (b ? b.length : 0)) * 25));
  }

  type(str, delay, append = false) {
    const step = this.reduceMotion ? 0 : 42;
    const chars = Array.from(str);
    if (!step) {
      this.timers.push(setTimeout(() => {
        this.textEl.textContent = append ? `${this.textEl.textContent}\n${str}` : str;
      }, delay));
      return delay;
    }
    this.timers.push(setTimeout(() => { this.textEl.textContent = append ? `${this.textEl.textContent}\n` : ''; }, delay));
    let t = delay;
    for (const ch of chars) {
      t += step;
      const at = t;
      this.timers.push(setTimeout(() => { this.textEl.textContent += ch; this.pulse(); }, at));
      if (/[、。…？！]/.test(ch)) t += 110;
    }
    return t;
  }

  pulse() {
    if (!this.reduceMotion && Math.random() < 0.012) this.face.blink();
  }

  ask() {
    this.el.classList.add('is-ask');
    this.chipsEl.innerHTML = '';
    const mk = (label, cat) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = label;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this.say(cat, { priority: 5, force: true }); });
      this.chipsEl.appendChild(b);
    };
    mk('教えてあげる', 'teachYes');
    mk('あとでね', 'teachNo');
    this.timers.push(setTimeout(() => this.hide(), 14000));
  }

  show() {
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('is-on'));
  }

  hide() {
    this.speaking = false;
    this.priority = 0;
    this.el.classList.remove('is-on');
    this.timers.push(setTimeout(() => { if (!this.speaking) this.el.hidden = true; }, 320));
  }
}

export function greetingCategory(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'greet.morning';
  if (h >= 11 && h < 17) return 'greet.day';
  if (h >= 17 && h < 23) return 'greet.evening';
  return 'greet.night';
}
