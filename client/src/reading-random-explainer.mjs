/** Static editorial content. Opening this explanation never requests randomness. */
export const randomSourceExplanation = Object.freeze({
  title: '随机数从哪里来',
  sections: [
    { title: '系统随机', paragraphs: [
      '浏览器在你的设备上使用专为安全用途设计的算法，通常以系统收集的随机信息为起点，生成难以预测的数列。具体做法随浏览器和操作系统有所不同。',
      '开始洗牌时，Augurwell 在本地读取这些数，决定牌序和正逆位。响应很快，也不会消耗共享量子库存。',
    ] },
    { title: 'ANU 量子随机', paragraphs: [
      '它来自澳大利亚国立大学（ANU）的光学实验。即使在真空中，电磁场也存在细微的量子涨落；实验测量这些起伏，将结果转换成随机数，再通过网络提供给应用。',
      'Augurwell 每次采集保存一批数，洗牌时从共享库存中取用。“上次获取”记录的是这批数进入应用的时间。',
    ] },
    { title: '从随机数到一副牌', paragraphs: [
      '两种来源使用同一套洗牌规则：先打乱 78 张牌的顺序，再分别决定每张牌的正逆位。换算时会跳过无法均分到各个位置的数，让每个位置获得均等的机会。',
    ] },
  ],
  sources: [
    { label: 'W3C · 系统随机', url: 'https://www.w3.org/TR/webcrypto/#Crypto-method-getRandomValues' },
    { label: 'ANU · 量子测量', url: 'https://quantumnumbers.anu.edu.au/faq' },
  ],
});
