import type { GuideEntry } from "../types/model/tensionChallengeGuide";
import type { TensionChallenge } from "../types/model/tensionChallenge";
export const tensionGuideBaseline: Pick<TensionChallenge, "config" | "fish"> = {
  config: {
    tickRate: 60, safeMin: 35, safeMax: 70, maxTension: 100,
    startTension: 50, startDistance: 70, reelRate: 24, releaseRate: -48,
    reelSpeed: 6, slackEscapeSeconds: 2.5, slackThresholdRatio: 0.5,
    slackDistanceRate: 2, fishPullMultiplier: 1, minimumStrength: 0.4,
  },
  fish: {
    id: "ID loài cá của session", baseStrength: 1, burstChance: 0.55,
    burstMin: 10, burstMax: 20, staminaDrain: 0.05, basePull: 32,
    pullAmplitude: 8, pullPeriodTicks: 126, burstMinTicks: 24, burstMaxTicks: 84,
  },
};

// Exhaustive maps keep every protocol key represented in the guide.
export const configGuide = {
  tickRate: {
    name: "Nhịp mô phỏng", unit: "tick/giây",
    meaning: "Số bước tính toán trong một giây của ván đấu.",
    mechanism: "60 nghĩa là mỗi bước dài khoảng 16,67 ms. Đây là nhịp tính luật chơi, độc lập với tốc độ vẽ hình của thiết bị.",
    tuning: "Giữ 60 khi cân bằng độ khó. Đổi nhịp thì đổi cả các thông số có đơn vị tick nếu muốn giữ nguyên thời lượng.",
    example: "Cú giật 24–84 tick kéo dài 0,4–1,4 giây ở 60 tick/giây; ở 120 thì chỉ còn 0,2–0,7 giây.",
  },
  safeMin: {
    name: "Đầu vùng an toàn", unit: "điểm lực căng",
    meaning: "Mốc bắt đầu vùng xanh và mốc tối thiểu để thu dây kéo cá lại gần.",
    mechanism: "Từ mốc này trở lên, giữ nút sẽ kéo cá gần. Dưới mốc này cá lùi xa và không bị hao thể lực.",
    tuning: "Hạ mốc giúp dễ bắt đầu thu cá hơn, nhưng cũng thay đổi ngưỡng dây quá chùng vì ngưỡng đó phụ thuộc safeMin.",
    example: "35 → 30: người mới chỉ cần nâng lực căng lên 30 để bắt đầu kéo cá, thay vì 35.",
  },
  safeMax: {
    name: "Cuối vùng an toàn", unit: "điểm lực căng",
    meaning: "Mốc trên của vùng xanh; vượt qua là vùng nguy hiểm.",
    mechanism: "Cá chỉ hao thể lực khi lực căng nằm trong đoạn safeMin đến safeMax, tính cả hai đầu. Vượt safeMax chưa làm đứt dây ngay.",
    tuning: "Tăng mốc này làm vùng xanh rộng hơn và dễ làm cá mệt hơn, nhưng khoảng đệm tới maxTension sẽ nhỏ hơn.",
    example: "70 → 75: vùng làm cá mệt rộng thêm 5 điểm; khoảng đệm trước khi đứt dây còn 25 điểm nếu maxTension = 100.",
  },
  maxTension: {
    name: "Ngưỡng đứt dây", unit: "điểm lực căng",
    meaning: "Chạm hoặc vượt mốc này là thua vì dây đứt.",
    mechanism: "Được kiểm tra ở từng tick. Mốc này cũng là thang tối đa của thanh lực căng.",
    tuning: "Tăng mốc tạo thêm khoảng đệm trước cú giật. Cần chỉnh vùng xanh cùng lúc nếu muốn giữ tỷ lệ hiển thị tương tự.",
    example: "100 → 110, giữ safeMax = 70: khoảng đệm tăng từ 30 lên 40 điểm.",
  },
  startTension: {
    name: "Lực căng ban đầu", unit: "điểm lực căng",
    meaning: "Vị trí lực căng khi ván đấu bắt đầu.",
    mechanism: "RPC rules v2 đặt lực ban đầu bằng 50% ngưỡng đứt dây, nằm sẵn trong vùng xanh 35%–70%.",
    tuning: "Đặt trong vùng xanh để người mới nhập cuộc nhẹ nhàng. Đặt quá gần ngưỡng đứt làm cú giật đầu rất nguy hiểm.",
    example: "30 → 40: bắt đầu sẵn trong vùng xanh 35–70, cá có thể mệt ngay từ đầu.",
  },
  startDistance: {
    name: "Khoảng cách ban đầu", unit: "mét mô phỏng",
    meaning: "Quãng đường cần thu về để đưa cá tới khoảng cách 0 và thắng.",
    mechanism: "Đồng thời là giới hạn xa nhất: cá lùi khi dây chùng nhưng không xa quá giá trị này.",
    tuning: "Tăng để kéo dài ván đấu; kiểm tra cùng reelSpeed và thời hạn session để vẫn có thể thắng.",
    example: "100 m với reelSpeed = 7 cần khoảng 14,3 giây thu dây hiệu quả; thời gian thật thường dài hơn do phải nhả dây.",
  },
  reelRate: {
    name: "Lực do thu dây", unit: "điểm/giây",
    meaning: "Phần tăng lực căng do người chơi giữ nút thu dây.",
    mechanism: "Cộng vào lực kéo đã tính của cá. Giá trị này không trực tiếp quyết định số mét thu được.",
    tuning: "Tăng giúp nâng dây đang chùng nhanh hơn, đồng thời làm giữ nút lâu dễ đứt dây hơn.",
    example: "Cá đang tạo lực 7 điểm/giây: giữ nút với reelRate = 24 làm lực căng tăng khoảng 31 điểm/giây.",
  },
  releaseRate: {
    name: "Lực do nhả dây", unit: "điểm/giây, số âm",
    meaning: "Phần giảm lực căng khi người chơi thả nút.",
    mechanism: "Vẫn cộng với lực kéo của cá. Nếu cá kéo mạnh hơn độ lớn của số âm này, thả nút vẫn làm lực căng tăng.",
    tuning: "-28 → -34 giúp hạ lực căng nhanh hơn. Đổi lại, nhả quá lâu sẽ đưa dây xuống vùng quá chùng nhanh hơn.",
    example: "Cá kéo 42 điểm/giây, nhả -28: tổng vẫn tăng 14 điểm/giây. Cần chừa khoảng đệm trước cú giật.",
  },
  reelSpeed: {
    name: "Tốc độ kéo cá gần", unit: "mét/giây",
    meaning: "Tốc độ giảm khoảng cách khi đang giữ nút và dây đủ căng.",
    mechanism: "Chỉ có tác dụng nếu tension ≥ safeMin. Vượt safeMax vẫn kéo được cá, nhưng cá không mệt và dây dễ đứt.",
    tuning: "Tăng để ván ngắn hơn hoặc thể hiện máy câu tốt hơn; đây là chỉ số khác với reelRate.",
    example: "7 → 9: thu hiệu quả 100 m giảm từ khoảng 14,3 xuống 11,1 giây, chưa tính những lúc nhả dây.",
  },
  slackEscapeSeconds: {
    name: "Thời gian chịu dây quá chùng", unit: "giây liên tục",
    meaning: "Cá thoát nếu dây quá chùng liên tục lâu hơn khoảng này.",
    mechanism: "Chỉ đếm khi tension < safeMin × slackThresholdRatio. Chạm lại ngưỡng hoặc cao hơn thì bộ đếm về 0.",
    tuning: "Tăng giúp người mới có thêm thời gian phản ứng. Không phải mọi lúc ở ngoài vùng xanh đều bị cộng bộ đếm.",
    example: "35 × 0,5 = 17,5: chỉ khi dưới 17,5 liên tục hơn 2,5 giây thì cá mới thoát vì dây chùng.",
  },
  slackThresholdRatio: {
    name: "Tỷ lệ xác định dây quá chùng", unit: "hệ số của safeMin",
    meaning: "Nhân với đầu vùng xanh để ra ngưỡng bắt đầu đếm thời gian cá thoát.",
    mechanism: "Đây là một mốc riêng, thấp hơn hoặc bằng safeMin; không phải phần trăm của maxTension.",
    tuning: "Tăng tỷ lệ làm ngưỡng quá chùng cao hơn, nên dễ bị bắt đầu đếm thời gian thoát hơn.",
    example: "Với safeMin = 35: tỷ lệ 0,5 cho ngưỡng 17,5; tăng lên 0,7 cho ngưỡng 24,5.",
  },
  slackDistanceRate: {
    name: "Tốc độ cá lùi khi dây chùng", unit: "mét/giây",
    meaning: "Tốc độ tăng khoảng cách khi lực căng dưới đầu vùng xanh.",
    mechanism: "Áp dụng khi tension < safeMin, kể cả chưa xuống ngưỡng quá chùng. Khoảng cách bị chặn ở startDistance.",
    tuning: "Tăng làm việc thả dây quá tay tốn nhiều tiến độ hơn; giảm giúp ván đấu bớt kéo dài.",
    example: "2 → 3: mỗi 2 giây dây chùng làm mất tối đa 6 m tiến độ thay vì 4 m.",
  },
  fishPullMultiplier: {
    name: "Hệ số lực cá vào dây", unit: "hệ số",
    meaning: "Khuếch đại hoặc giảm toàn bộ lực cá trước khi tác động lên lực căng.",
    mechanism: "Nhân cả lực nền lẫn cú giật, sau hệ số sức cá và mức thể lực. Không nhân reelRate hay releaseRate.",
    tuning: "Giảm để trang bị khắc chế lực cá; tăng khiến cả giữ lẫn thả đều chịu lực cá lớn hơn.",
    example: "Cá tạo lực thô 60, sức cá = 1 và còn khỏe: hệ số 0,7 đưa 42 điểm/giây vào dây.",
  },
  minimumStrength: {
    name: "Sức lực còn lại khi kiệt sức", unit: "tỷ lệ 0–1",
    meaning: "Phần sức cá vẫn giữ lại khi thể lực đã về 0.",
    mechanism: "Hệ số theo thể lực = minimumStrength + (1 − minimumStrength) × stamina. Stamina bắt đầu ở 1.",
    tuning: "Giảm giúp cuối ván dễ kiểm soát hơn. Bằng 1 thì cá không yếu đi dù thể lực giảm.",
    example: "0,4: cá kiệt sức vẫn kéo bằng 40% lúc khỏe. Khi còn nửa thể lực, hệ số là 0,7.",
  },
} satisfies Record<keyof TensionChallenge["config"], GuideEntry>;

export const fishGuide = {
  id: {
    name: "Mã loài cá", unit: "chuỗi ID",
    meaning: "Xác định loài cá được chọn cho session; không tự tăng độ khó.",
    mechanism: "Dùng để nhận diện. Các phép tính sức kéo đọc những chỉ số khác trong fish; riêng ID không tự tăng độ khó.",
    tuning: "Nếu muốn từng loài có sức khác nhau, server cần lấy chỉ số tương ứng trước khi tạo challenge.",
    example: "Hai ID khác nhau nhưng cùng các tham số và seed sẽ có cùng diễn biến mô phỏng khi thao tác giống nhau.",
  },
  baseStrength: {
    name: "Sức mạnh riêng của cá", unit: "hệ số",
    meaning: "Nhân toàn bộ lực kéo nền và cú giật của con cá.",
    mechanism: "RPC rules v2 lấy sức hiệu lực S từ species.strength, khối lượng và hiệu ứng, rồi chia cho 40. Rarity điều chỉnh nhịp đấu, không nhân thêm sức cá.",
    tuning: "Tăng để thể hiện cá khỏe hơn; cần xem cùng burstMax và releaseRate để người chơi còn khoảng xử lý.",
    example: "Sức hiệu lực 40 cho baseStrength = 1; sức 48 cho 1,2. Với lực thô 60, hệ số vào dây 1 và đầy thể lực, lực vào dây lần lượt là 60 và 72 điểm/giây.",
  },
  burstChance: {
    name: "Xác suất xuất hiện cú giật", unit: "xác suất 0–1",
    meaning: "Khả năng có một cú giật khi hệ thống chọn nhịp vùng vẫy tiếp theo.",
    mechanism: "0,55 là 55% ở mỗi lần chọn nhịp, không phải 55% mỗi tick. Nhịp không giật vẫn có lực kéo nền.",
    tuning: "Giảm tạo nhiều khoảng nghỉ hơn. Tăng làm cú giật xuất hiện thường xuyên hơn nhưng không tự tăng độ mạnh từng cú.",
    example: "0,55 → 0,35: trung bình khoảng 35 trên 100 lần chọn nhịp có giật, thay vì 55; chuỗi thật phụ thuộc seed.",
  },
  burstMin: {
    name: "Lực giật tối thiểu", unit: "điểm lực thô/giây",
    meaning: "Đầu dưới của khoảng lực cộng thêm khi có cú giật.",
    mechanism: "Lực giật được cộng vào nền trước khi nhân baseStrength, hệ số thể lực và fishPullMultiplier.",
    tuning: "Tăng làm cả cú giật nhẹ nhất cũng mạnh hơn; luôn giữ burstMin ≤ burstMax.",
    example: "Nền đang là 10, giật thêm 25: lực thô thành 35; cá khỏe hệ số 1 và vào dây 0,7 thì tạo 24,5 điểm/giây.",
  },
  burstMax: {
    name: "Lực giật tối đa", unit: "điểm lực thô/giây",
    meaning: "Đầu trên để sinh lực giật ngẫu nhiên; lực sinh thực tế nhỏ hơn mốc này.",
    mechanism: "Độ nguy hiểm còn phụ thuộc cú giật kéo dài bao lâu, lúc đó nền đang mạnh hay yếu và cá còn bao nhiêu thể lực.",
    tuning: "Giảm để hạ nguy cơ tăng lực căng quá nhanh; cân đối cùng burstMaxTicks thay vì chỉ tăng độ mạnh.",
    example: "Nền gần đỉnh 18, giật gần 60: cá khỏe hệ số 1 tạo gần 54,6 điểm/giây vào dây; nhả -28 vẫn còn tăng gần 26,6.",
  },
  staminaDrain: {
    name: "Tốc độ hao thể lực", unit: "phần thể lực/giây",
    meaning: "Tốc độ giảm stamina từ 1 về 0 trong khi lực căng nằm trong vùng xanh.",
    mechanism: "Chỉ giảm ở safeMin ≤ tension ≤ safeMax, kể cả đang nhả dây. Ra ngoài vùng xanh thì thể lực giữ nguyên.",
    tuning: "Tăng làm cá mệt sớm hơn; giảm kéo dài giai đoạn cá khỏe. Chỉ số rất nhỏ có thể bị cắt về 0 ở từng tick.",
    example: "0,05 đặt mức 5%/giây; do cắt phần lẻ ở 60 tick/giây, thực tế khoảng 4,8%/giây, cần 20,8 giây tích lũy trong vùng xanh để kiệt sức.",
  },
  basePull: {
    name: "Lực kéo nền", unit: "điểm lực thô/giây",
    meaning: "Mức kéo trung tâm luôn có, kể cả ở những nhịp không xuất hiện cú giật.",
    mechanism: "Nền dao động từ basePull − pullAmplitude đến basePull + pullAmplitude theo một sóng tam giác.",
    tuning: "Tăng làm cá kéo dai hơn trong cả ván. Giữ pullAmplitude ≤ basePull để nền không thành lực âm.",
    example: "basePull = 10, pullAmplitude = 8: lực nền chạy lên xuống trong khoảng 2–18 trước khi nhân các hệ số.",
  },
  pullAmplitude: {
    name: "Biên độ dao động lực nền", unit: "điểm lực thô/giây",
    meaning: "Khoảng lệch lên và xuống so với lực nền trung tâm.",
    mechanism: "Đây là nhịp kéo lên xuống đều, khác với các cú giật ngẫu nhiên. Bằng 0 thì nền giữ nguyên basePull.",
    tuning: "Tăng tạo chênh lệch lớn hơn giữa lúc cá kéo nhẹ và kéo mạnh; giảm giúp dễ dự đoán lực hơn.",
    example: "Vẫn basePull = 10: biên độ 8 cho nền 2–18; hạ còn 4 thì nền chỉ dao động 6–14.",
  },
  pullPeriodTicks: {
    name: "Chu kỳ dao động lực nền", unit: "tick, số nguyên",
    meaning: "Số tick cho một vòng lực nền đi từ thấp lên cao rồi trở về thấp.",
    mechanism: "Thời gian một vòng = pullPeriodTicks ÷ tickRate. Ván bắt đầu ở đáy sóng, lên đỉnh ở nửa chu kỳ.",
    tuning: "Tăng làm nhịp nền chậm hơn; giảm khiến lực nền đổi nhanh hơn. Đây không phải nhịp xuất hiện cú giật.",
    example: "126 ÷ 60 = 2,1 giây/vòng. Đổi thành 180 ở cùng tickRate cho chu kỳ 3 giây.",
  },
  burstMinTicks: {
    name: "Độ dài nhịp giật ngắn nhất", unit: "tick, số nguyên",
    meaning: "Thời lượng tối thiểu của một nhịp vùng vẫy được chọn.",
    mechanism: "Mỗi nhịp giữ nguyên lực giật đã sinh; nhịp không có giật cũng chờ hết thời lượng rồi mới chọn tiếp.",
    tuning: "Tăng khiến các nhịp ngắn nhất dài hơn; nếu nhịp có giật, người chơi phải chịu lực đó lâu hơn.",
    example: "24 tick ở 60 tick/giây = 0,4 giây; tăng lên 36 là ít nhất 0,6 giây mỗi nhịp.",
  },
  burstMaxTicks: {
    name: "Độ dài nhịp giật dài nhất", unit: "tick, số nguyên",
    meaning: "Thời lượng tối đa của một nhịp, tính cả mốc này.",
    mechanism: "Thời lượng được chọn trong đoạn burstMinTicks đến burstMaxTicks. Nhịp mạnh và dài tạo áp lực lớn dù đã thả nút.",
    tuning: "Giảm để tránh chuỗi giật kéo dài; luôn giữ burstMaxTicks ≥ burstMinTicks.",
    example: "84 tick = 1,4 giây ở 60 tick/giây. Hạ xuống 60 giới hạn nhịp còn 1 giây.",
  },
} satisfies Record<keyof TensionChallenge["fish"], GuideEntry>;

export const tensionGuideEntries = [
  ...Object.entries(configGuide).map(([key, entry]) => ({ section: "config" as const, key, value: tensionGuideBaseline.config[key as keyof typeof configGuide], ...entry })),
  ...Object.entries(fishGuide).map(([key, entry]) => ({ section: "fish" as const, key, value: tensionGuideBaseline.fish[key as keyof typeof fishGuide], ...entry })),
];

function preset(id: string, icon: string, title: string, audience: string, reason: string, advice: string,
  config: Partial<TensionChallenge["config"]> = {}, fish: Partial<TensionChallenge["fish"]> = {}) {
  return { id, icon, title, audience, reason, advice,
    config: { ...tensionGuideBaseline.config, ...config }, fish: { ...tensionGuideBaseline.fish, ...fish } };
}

export const tensionGuidePresets = [
  preset("baseline", "🎣", "Cá hiếm tiêu chuẩn", "Ví dụ rules v2: cá sức 40, dây 100, máy 80",
    "Cá RARE ở khối lượng trung tâm, hệ số giật 1,5; dây chịu 100 và máy có pull_strength = 80. Session thật thay đổi theo cá, trang bị và hiệu ứng.",
    "Giữ lực trong vùng xanh để cá mệt, đồng thời chừa khoảng đệm cho cú giật kế tiếp."),
  preset("beginner", "🌱", "Người mới làm quen", "Gợi ý cho bãi câu hướng dẫn",
    "Vào ván sẵn trong vùng xanh, cú giật ít và nhẹ hơn; thêm thời gian xử lý khi dây quá chùng.",
    "Nếu người mới vẫn hay thua ngay đầu ván, kiểm tra lực giật và khoảng đệm trước khi tăng tốc kéo cá.",
    { safeMin: 30, safeMax: 75, startTension: 40, reelSpeed: 8, slackEscapeSeconds: 3, minimumStrength: 0.3 },
    { baseStrength: 0.85, burstChance: 0.35, burstMax: 15, staminaDrain: 0.07 }),
  preset("legendary", "👑", "Cá huyền thoại", "Gợi ý tăng sức, giới hạn độ dài cú giật",
    "Ví dụ tăng sức hiệu lực 20% và giới hạn cú giật còn 1,1 giây, với lực giật cộng thêm tối đa 25. Đây là cấu hình gợi ý, không phải hệ số tự động theo rarity.",
    "Ưu tiên thử nhiều seed có chuỗi giật liên tiếp. Tránh cùng lúc tăng sức cá, lực giật và thời lượng giật quá mạnh.",
    { startTension: 40, reelSpeed: 6.5 },
    { baseStrength: 1.2, burstMax: 25, burstMaxTicks: 66 }),
  preset("equipment", "⚙️", "Nâng cấp máy câu", "Gợi ý thể hiện lợi ích trang bị",
    "Giữ sức cá và thao tác nhả như cũ, tăng pull_strength từ 80 lên 140 để tốc độ thu tăng từ 6 lên 9 m/giây khi S = 40.",
    "Máy tăng tốc độ thu khoảng cách; ngưỡng đứt vẫn do dây quyết định, cần giữ lực trong vùng xanh.",
    { reelSpeed: 9 }),
];

export function formatGuideNumber(value: string | number) {
  return typeof value === "number" ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value) : value;
}
