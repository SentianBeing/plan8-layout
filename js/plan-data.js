/**
 * Plan-8 layout: geometry traced from the approved plan drawing (plan-8 Model.pdf)
 * ------------------------------------------------------------------------------
 * Units are drawing units (≈10.03 per metre, scale 1:600 at 300 dpi / 3).
 * The drawing is shown the way its text reads, which puts NORTH on the LEFT:
 *   top = East, right = South, bottom = West, left = North.
 * Each plot: corner points clockwise from top-left, and the edge lengths in metres
 * exactly as written on the plan (null = no figure on the plan, measured instead;
 * 0 = short segment that belongs to the next edge's written length).
 */
window.PLAN8_PLAN = (() => {
  const K = 10.03;
  const STD = [9.14, 15.24, 9.14, 15.24];
  const S40 = [9.14, 12.19, 9.14, 12.19];
  const COL = [693, 785, 877, 968, 1060, 1151, 1243, 1335, 1411];
  const R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  const RAW = [];
  const add = (no, pts, dims, facing, corner) => RAW.push({ no, pts, dims, facing, corner: corner || null });
  const row = (nums, y0, y1, dims, facing) => nums.forEach((n, i) => add(n, R(COL[i], y0, COL[i + 1], y1), dims, facing));

  // Plots 1–4 sit inside Park 1 and open onto the 12 m road
  const Y14 = [194, 287, 379, 470, 562];
  for (let i = 0; i < 4; i++) add(i + 1, R(421, Y14[i], 573, Y14[i + 1]), [15.24, 9.14, 15.24, 9.14], "South");
  // Block 5–22
  row([5, 6, 7, 8, 9, 10, 11], 286, 438, STD, "East");
  add(12, R(1335, 286, 1411, 438), [7.62, 15.24, 7.62, 15.24], "East");
  add(13, [[1411, 286], [1476, 286], [1500, 438], [1411, 438]], [6.41, null, 8.85, 15.24], "East");
  row([22, 21, 20, 19, 18, 17, 16], 438, 560, S40, "West");
  add(15, R(1335, 438, 1411, 560), [7.62, 12.19, 7.62, 12.19], "West");
  add(14, [[1411, 438], [1500, 438], [1501, 560], [1411, 560]], [8.85, 12.19, 8.99, 12.19], "West");
  // Block 23–36
  row([23, 24, 25, 26, 27, 28], 652, 805, STD, "East");
  add(29, [[1243, 652], [1364, 652], [1356, 805], [1243, 805]], [12.07, 15.26, null, 15.24], "East");
  row([36, 35, 34, 33, 32, 31], 805, 957, STD, "West");
  add(30, [[1243, 805], [1356, 805], [1348, 957], [1243, 957]], [null, 15.26, 10.49, 15.24], "West");
  // Block 37–50
  row([37, 38, 39, 40, 41, 42], 1077, 1230, STD, "East");
  add(43, [[1243, 1077], [1344, 1077], [1357, 1230], [1243, 1230]], [10.02, 15.36, 11.29, 15.24], "East");
  row([50, 49, 48, 47, 46, 45], 1230, 1383, STD, "West");
  add(44, [[1243, 1230], [1357, 1230], [1373, 1383], [1243, 1383]], [11.29, 15.27, 12.94, 15.24], "West");
  // Block 51–61
  row([51, 52, 53], 1474, 1628, STD, "East");
  add(54, [[968, 1474], [1061, 1474], [1061, 1634], [968, 1670]], [7.67, 16.12, 8.24, 19.15], "East");
  add(55, [[1061, 1474], [1151, 1474], [1151, 1616], [1061, 1634]], [9.14, 14.32, 9.32, 16.12], "East");
  add(56, [[1151, 1474], [1243, 1474], [1243, 1598], [1151, 1616]], [9.14, 12.51, 9.32, 14.32], "East");
  add(57, [[1243, 1474], [1380, 1474], [1380, 1570], [1243, 1598]], [13.26, 9.75, 14.41, 12.51], "East");
  // 58: the east side runs straight for ~4 m, then follows the slanted site boundary (12.20 m in total)
  add(58, [[693, 1628], [968, 1628], [968, 1670], [976, 1750], [693, 1750]], [27.43, 0, 12.20, 27.97, 12.19], "North");
  add(59, [[693, 1750], [976, 1750], [984, 1870], [693, 1870]], [27.97, 12.23, 28.98, 12.19], "North");
  add(60, [[693, 1870], [846, 1870], [846, 1990], [693, 2011]], [15.24, 11.95, 15.38, 14.04], "North", "West");
  add(61, [[846, 1870], [984, 1870], [989, 1970], [846, 1990]], [13.74, 9.99, 14.70, 11.95], "West");
  // Corner plots that also touch the 12 m road on the North
  const CORNER_N = { 5: 1, 22: 1, 23: 1, 36: 1, 37: 1, 50: 1, 51: 1 };

  // Site boundary (thick line on the plan), measured from the drawing at 300 dpi.
  // The 2.00 m step on the west side sits at y≈1149.
  const SITE = [[170, 136], [955, 103], [1196, 123], [1362, 112], [1451, 166], [1501, 405], [1502, 669], [1364, 669], [1347, 957], [1342, 1077], [1371, 1383], [1378, 1474], [1380, 1570], [1047, 1637], [968, 1670], [998, 2049], [574, 2082], [515, 1737], [480, 1150], [500, 1148], [458, 720], [197, 707]];
  // Hatched "road widening area" strips inside the boundary (legend on the plan)
  const WIDEN_N = [[170, 136], [955, 103], [1196, 123], [1362, 112], [1451, 166], [1457, 193], [1440, 183], [1365, 131], [1196, 141], [955, 121], [573, 138], [181, 153], [219, 708], [197, 707]];
  const WIDEN_W = [[480, 1150], [500, 1148], [499, 1200], [522, 1400], [541, 1640], [562, 1800], [572, 1880], [581, 1960], [596, 2081], [574, 2082], [515, 1737]];
  // Park 1 ends in a 2.73 m wide tip at y≈1657; Park 2 sits between the widening strip and the road
  const PARK1 = [[181, 153], [573, 138], [573, 1657], [543, 1657], [541, 1640], [522, 1400], [499, 1200], [500, 1148], [458, 720], [219, 708]];
  const PARK2 = [[573, 138], [955, 121], [1196, 141], [1365, 131], [1440, 183], [1457, 193], [573, 193]];
  const UTILITY = R(516, 905, 573, 1083);
  const STP = R(284, 648, 342, 684);
  const ROADS = [
    { pts: [[573, 195], [1458, 195], [1476, 286], [573, 286]], c: [[573, 240], [1466, 240]], label: "9.14 M WIDE ROAD", at: [1030, 240], ang: 0 },
    { pts: [[573, 560], [1501, 560], [1501, 652], [573, 652]], c: [[693, 606], [1501, 606]], label: "9.14 M WIDE ROAD", at: [1030, 606], ang: 0 },
    { pts: [[573, 957], [1347, 957], [1344, 1077], [573, 1077]], c: [[693, 1017], [1346, 1017]], label: "12.0 M WIDE ROAD", at: [1000, 1017], ang: 0 },
    { pts: [[573, 1383], [1373, 1383], [1380, 1474], [573, 1474]], c: [[693, 1428], [1376, 1428]], label: "9.14 M WIDE ROAD", at: [1030, 1428], ang: 0 },
    { pts: [[573, 195], [693, 195], [693, 2011], [573, 2028]], c: [[633, 240], [633, 2018]], label: "12.0 M WIDE ROAD", at: [633, 1230], ang: -90 }
  ];
  // Existing 12 m road (red lines on the plan): from the west, down the site's west side, then east.
  // The outer 18 m lines show the proposed widening. The south leg runs at a slope of -0.137.
  const K_S = -0.137;
  const slopeLine = (y0, x0) => x => y0 + K_S * (x - x0);
  const L1 = slopeLine(1971, 994), L2 = slopeLine(2055, 600), L3 = slopeLine(2176.3, 600), L4 = slopeLine(2212.7, 600);
  const ROAD_END = 1560;
  const WIDEN_OUT = [[-700, 1657], [546, 1657], [573, 1657], [573, L1(573)], [ROAD_END, L1(ROAD_END)], [ROAD_END, L4(ROAD_END)], [421.7, L4(421.7)], [421.7, 1837], [-700, 1837]];
  const EXIST_ROAD = [[-700, 1687], [572, 1687], [572, L2(572)], [ROAD_END, L2(ROAD_END)], [ROAD_END, L3(ROAD_END)], [451.7, L3(451.7)], [451.7, 1807], [-700, 1807]];
  const OUT_ROAD9 = [[602, L4(602)], [693, L4(693)], [693, 2900], [602, 2900]];
  const SLOPE = Math.atan2(K_S, 1) * 180 / Math.PI;
  // Survey numbers as written on the plan
  const SURVEY = [["29", 126, 236], ["30", 136, 740], ["31", 402, 884], ["32/1", 462, 1344], ["32/2", 658, 1256], ["32/3", 666, 690], ["32/4", 666, 230], ["32/5", 1390, 262], ["33/1", 638, 1830], ["33/2", 1056, 1830], ["34/1", 1556, 240], ["34/2", 1558, 576]];

  return {
    K, R, RAW, CORNER_N, SITE, WIDEN_N, WIDEN_W, PARK1, PARK2, UTILITY, STP, ROADS,
    L1, L2, L3, L4, ROAD_END, WIDEN_OUT, EXIST_ROAD, OUT_ROAD9, SLOPE, SURVEY,
    PLOTS14_BOX: R(410, 185, 573, 572),
    BOUNDS: { x0: 160, y0: 90, x1: 1520, y1: 2100 },
    HOME: { cx: 840, cy: 1110 },
    RESIDENTIAL_M2: 8818.9,
    SIDE_BY_NORMAL: { up: "East", right: "South", down: "West", left: "North" }
  };
})();
