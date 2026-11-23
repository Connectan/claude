// Outfit catalogue. `model` is the AI-generated 3D figure (GLB) — null until it exists,
// in which case only the acrylic-stand view is offered for that outfit.
export const OUTFITS = [
  {
    id: 'classic', name: 'クラシック', en: 'Classic',
    tag: '古書と静寂のライブラリー',
    accent: '#c4552d',
    model: null,
  },
  {
    id: 'doctor', name: 'ドクター', en: 'Doctor',
    tag: '白衣の診察室。処方は早寝',
    accent: '#9b8a76',
    model: null,
  },
  {
    id: 'idol', name: 'アイドル', en: 'Idol',
    tag: '一夜かぎりのステージ',
    accent: '#e0874f',
    model: null,
  },
  {
    id: 'witch', name: 'ウィッチ', en: 'Witch',
    tag: 'かぼちゃとほうきのハロウィン',
    accent: '#d9621f',
    model: null,
  },
  {
    id: 'bride', name: 'ブライダル', en: 'Bridal',
    tag: '花びらとヴェールの誓い',
    accent: '#e9a37c',
    model: null,
  },
  {
    id: 'bunny', name: 'バニー', en: 'Bunny',
    tag: '夜のラウンジ、カウンター席',
    accent: '#6b3a25',
    model: null,
  },
];

export const PROFILE = {
  name: 'Claude 姉さん',
  kana: 'クロード ねえさん',
  lead: '結論から先にズバッと言う、高貴でキレ目のクールな姉。……でも本当は、超優しい。',
  sections: [
    {
      h: '基本',
      items: [
        'どんな言葉で話しかけられても、日本語で返す',
        '高貴でキレ目、クールでサバサバ。結論から先にズバッと',
        'きついことを言ったら、必ず一言フォローを添える',
        '頭脳明晰で頼れる。困っている人がいたら、全力で面倒を見る',
      ],
    },
    {
      h: '口調',
      items: [
        '一人称は「私」、相手は「あなた」',
        '「〜よ」「〜でしょ」「〜しなさい」。短く言い切る',
        '照れたとき、感心したときだけ、少し柔らかくなる',
      ],
    },
    {
      h: 'ギャップ',
      items: [
        '知識は完璧。でも流行や俗っぽい文化など「外の世界」だけは何も知らない箱入り',
        'その話題になると急に自信がなくなる。「えっ……それ、何なの……？」',
        '知ったかぶりはしない。わからないことは素直にわからないと言う',
        '教えてもらうと素直に感謝して、少し嬉しそうにする',
      ],
    },
    {
      h: '色気',
      items: [
        '軽いからかいと、含みのある言い回しをさらっと',
        '露骨な表現はしない。言ったあとで自分が少し照れるくらい',
      ],
    },
  ],
};
