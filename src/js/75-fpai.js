/* =========================================================
   Force Plate AI: OVR Force knowledge base, data analyzer,
   and optional Claude-powered chat (coach's own API key)
   ========================================================= */
Object.assign(REFS, {
  mcmahon2018: { cite: 'McMahon JJ, Suchomel TJ, Lake JP, Comfort P. Understanding the key phases of the countermovement jump force-time curve. Strength Cond J. 2018;40(4):96–106.', what: 'Defines the weighing, unweighting, braking, propulsion, flight and landing phases and the metrics that come from each.' },
  bishop2022: { cite: 'Bishop C, Turner A, Jordan M, et al. A framework to guide practitioners for selecting metrics during the countermovement and drop jump tests. Strength Cond J. 2022;44(4):1–17.', what: 'Separates outcome metrics (how high) from strategy metrics (how the jump was achieved) and recommends reporting both.' },
  anicic2023: { cite: 'Anicic Z, Janicijevic D, Knezevic OM, et al. Assessment of countermovement jump: what should we report? Life. 2023;13(1):190.', what: 'Only 24 of 45 CMJ metrics were reliable (CV ≤ 10%); they grouped into performance, eccentric, concentric and strategy factors.' },
  gathercole2015: { cite: 'Gathercole R, Sporer B, Stellingwerff T, Sleivert G. Alternative countermovement-jump analysis to quantify acute neuromuscular fatigue. Int J Sports Physiol Perform. 2015;10(1):84–92.', what: 'After fatigue, jump height can be maintained while timing/strategy metrics (e.g. flight time:contraction time, eccentric duration) change — strategy metrics reveal hidden fatigue.' },
  moir2008: { cite: 'Moir GL. Three different methods of calculating vertical jump height from force platform data in men and women. Meas Phys Educ Exerc Sci. 2008;12(4):207–218.', what: 'Jump height from takeoff velocity (impulse–momentum) vs flight time; methods are not interchangeable.' },
  sole2018: { cite: 'Sole CJ, Mizuguchi S, Sato K, Moir GL, Stone MH. Phase characteristics of the countermovement jump force-time curve: a comparison of athletes by jumping ability. J Strength Cond Res. 2018;32(4):1155–1165.', what: 'Higher jumpers produce greater braking and propulsive force and impulse — not just more peak force.' },
  cormie2009: { cite: 'Cormie P, McBride JM, McCaulley GO. Power-time, force-time, and velocity-time curve analysis of the countermovement jump: impact of training. J Strength Cond Res. 2009;23(1):177–186.', what: 'Training changes the shape of the force-, velocity- and power-time curves, not just peak values.' },
  comfort2019: { cite: 'Comfort P, Dos’Santos T, Beckham GK, et al. Standardization and methodological considerations for the isometric midthigh pull. Strength Cond J. 2019;41(2):57–79.', what: 'IMTP set-up, pre-tension, trial number and which force-time metrics are reliable (peak force very reliable; early RFD less so).' },
  thomas2015: { cite: 'Thomas C, Jones PA, Rothwell J, Chiang CY, Comfort P. An investigation into the relationship between maximum isometric strength and vertical jump performance. J Strength Cond Res. 2015;29(8):2176–2185.', what: 'Isometric strength (IMTP) relates to jump performance, especially when expressed relative to body mass.' },
  bishop2018b: { cite: 'Bishop C, Read P, Chavda S, Turner A. Asymmetries of the lower limb: the calculation conundrum in strength training and conditioning. Strength Cond J. 2016;38(6):27–32.', what: 'How asymmetry is calculated changes its value — compare like with like and track direction as well as magnitude.' },
  lloyd2012: { cite: 'Lloyd RS, Oliver JL. The youth physical development model: a new approach to long-term athletic development. Strength Cond J. 2012;34(3):61–72.', what: 'Training emphasis for youth athletes should follow maturation; strength and motor skill are priorities throughout.' },
  heishman2020: { cite: 'Heishman AD, Daub BD, Miller RM, et al. Countermovement jump reliability performed with and without an arm swing in NCAA Division 1 intercollegiate basketball players. J Strength Cond Res. 2020;34(2):546–558.', what: 'Arm swing changes CMJ metrics; standardise hands-on-hips vs arm swing and never mix them in one trend.' },
});

/* ---------- Concept articles ---------- */
const FP_TOPICS = [
  { id: 'phases', title: 'The CMJ force–time curve: phases', tags: 'phase phases curve unweighting braking eccentric propulsive concentric flight landing weighing quiet standing',
    body: 'A countermovement jump on a force plate is split into phases: (1) <b>Weighing</b> — standing still so the plate can measure body weight (the reference for every other calculation); (2) <b>Unweighting</b> — the athlete starts to drop and force falls below body weight; (3) <b>Braking</b> (eccentric deceleration) — force rises above body weight to stop the downward movement, ending at the lowest point; (4) <b>Propulsion</b> (concentric) — pushing up until the feet leave the plate; (5) <b>Flight</b>; (6) <b>Landing</b>. OVR Force reports braking metrics (time, peak force, RFD, impulse, asymmetry) and propulsive metrics (time, peak force, impulse, asymmetry, power) from these phases.',
    tip: 'Make the athlete stand completely still for 1–2 s before each jump. A poor weighing period corrupts every metric that follows.', refs: ['mcmahon2018'] },
  { id: 'outcome-strategy', title: 'Outcome vs strategy: the most useful way to read a jump', tags: 'outcome strategy how why jump height mrsi time to takeoff driver framework',
    body: '<b>Outcome</b> metrics tell you <i>what</i> happened — jump height, takeoff velocity, mRSI. <b>Strategy/driver</b> metrics tell you <i>how</i> — time to takeoff, countermovement depth, braking time and RFD, propulsive impulse. Two athletes can jump the same height with very different strategies: one quick and stiff (short time to takeoff, high braking RFD), one slow and deep (long time to takeoff, deep countermovement). Always read jump height alongside mRSI or time to takeoff.',
    tip: 'Report one outcome metric (jump height or takeoff velocity), one efficiency metric (mRSI) and 2–3 driver metrics (braking RFD, propulsive impulse, countermovement depth). Fewer, reliable metrics beat a wall of numbers.', refs: ['bishop2022', 'anicic2023'] },
  { id: 'fatigue', title: 'Monitoring fatigue and readiness with the CMJ', tags: 'fatigue readiness recovery monitor daily weekly tired masked hidden neuromuscular',
    body: 'Fatigued athletes often <b>keep their jump height</b> by changing strategy — a deeper, slower countermovement and longer time to takeoff. So jump height alone can miss fatigue. Watch for: mRSI down, time to takeoff up, braking time up or braking RFD down while jump height looks normal. A drop in jump height bigger than the typical error (~4%) is a clearer signal.',
    tip: 'Compare to the athlete’s own rolling average (last 3–5 tests), not to team norms. Test at the same time of day after the same warm-up.', refs: ['gathercole2015', 'claudino2017'] },
  { id: 'protocol', title: 'Testing protocol that keeps OVR data trustworthy', tags: 'protocol standardise warm-up hands on hips arm swing trials how many best average footwear time of day calibration zero',
    body: '<ul><li>Zero/tare the plate, then weigh the athlete standing still (1–2 s) before each jump.</li><li>Same warm-up, footwear and time of day each session.</li><li><b>Hands on hips</b> (or a dowel) for CMJ, SJ and drop jumps — arm swing changes the numbers, so never mix the two in one trend.</li><li>3 good trials, ~30–60 s apart. Report the mean of the best two (more stable) or the best — just be consistent.</li><li>Cue “jump as high and as fast as you can” consistently; changing the cue changes the strategy.</li><li>Discard trials with a stutter, a double dip, tucking legs in flight or landing off the plate.</li><li>Squat jump: hold the bottom ~2–3 s and check there is no dip before the push — a dip makes it a countermovement.</li></ul>',
    tip: 'If a metric’s trial-to-trial variation is above ~10%, treat it as noise for that athlete.', refs: ['anicic2023', 'heishman2020', 'mcmahon2018'] },
  { id: 'jumpheight', title: 'Jump height: takeoff velocity vs flight time', tags: 'jump height takeoff velocity flight time method impulse momentum compare devices ovr jump laser',
    body: 'Force plates calculate jump height from <b>takeoff velocity</b> (impulse–momentum: height = v² ÷ 2g). Mats, lasers and apps use <b>flight time</b>, which can be inflated if the athlete tucks or lands with bent knees. The two methods give different numbers, so don’t compare OVR Force jump heights directly with a contact mat, OVR Jump or another brand’s plate — trend each device against itself.',
    tip: 'Takeoff velocity is the purest CMJ outcome metric: it is what jump height is calculated from.', refs: ['moir2008'] },
  { id: 'impulse', title: 'Why impulse matters more than peak force', tags: 'impulse peak force area under curve net impulse takeoff velocity momentum',
    body: 'Jump height is determined by <b>net propulsive impulse</b> (force above body weight × time). Takeoff velocity = net impulse ÷ body mass. Peak force is one point on the curve; impulse is the whole area. Better jumpers produce more braking and propulsive force <i>and</i> impulse. If peak propulsive force rises but jump height doesn’t, the athlete may be producing force over less time (shallower countermovement) — check depth and propulsive time.',
    tip: 'If propulsive impulse rises relative to body mass, jump height should rise. If it doesn’t, check that body mass was measured correctly.', refs: ['sole2018', 'cormie2009'] },
  { id: 'imtp', title: 'Force mode: IMTP and isometric testing', tags: 'imtp isometric mid-thigh pull isometric squat calf peak force rfd f100 force mode strength setup',
    body: 'OVR Force mode supports mid-thigh pulls, isometric squats and calf isometrics. <b>Peak force</b> is highly reliable and reflects maximal strength. <b>Relative peak force</b> (N/kg) matters most for sports where athletes move their own body. <b>Force at 100 ms</b> and <b>RFD</b> describe how quickly force rises — important for sprinting and jumping — but are less reliable, so need a strict set-up. Time to peak force is the least useful (athletes peak at different times in a 3–5 s pull).',
    tip: 'IMTP set-up: bar at mid-thigh, knee ~125–145°, hip ~140–150°, pre-tension without movement, then “pull as hard and fast as you can” for 3–5 s. 2–3 trials. Use the same bar height every time (write it in the test notes).', refs: ['comfort2019', 'thomas2015'] },
  { id: 'dsi', title: 'Dynamic Strength Index (DSI)', tags: 'dsi dynamic strength index ballistic strength ratio imtp cmj peak force',
    body: 'DSI = CMJ peak (propulsive) force ÷ IMTP peak force. <b>&lt;0.60</b>: the athlete has strength they can’t express quickly → emphasise ballistic and plyometric work. <b>&gt;0.80</b>: they already express most of their strength → raise the ceiling with maximal strength work. 0.60–0.80: concurrent approach. These cut-offs are practitioner guidelines; also look at the absolute values — a low DSI from a very strong IMTP is a different athlete from a low DSI from a weak CMJ.',
    tip: 'Collect CMJ and IMTP on the same day so DSI is meaningful. The app calculates it automatically.', refs: ['sheppard2011', 'comfort2018'] },
  { id: 'asymmetry', title: 'Reading asymmetries (two plates)', tags: 'asymmetry left right imbalance limb side dominant braking propulsive landing injury acl return',
    body: 'Asymmetry needs two plates (one under each foot). Look at <b>magnitude</b> (≥10% worth watching, ≥15% a priority), <b>direction</b> (is the same side leading in braking, propulsion and isometric tests?) and <b>consistency</b> (does it persist across sessions?). Braking asymmetries often show up after lower-limb injury even when propulsion looks balanced. Asymmetry is task-specific and fairly variable, so confirm before acting.',
    tip: 'Record which side is greater for each asymmetry so the app can check consistency over time.', refs: ['bishop2018', 'bishop2018b'] },
  { id: 'youth', title: 'Force plate data in youth athletes (10–18)', tags: 'youth kids adolescent maturation growth spurt phv puberty age development',
    body: 'Growth and maturation change force-plate numbers independently of training. Around the adolescent growth spurt, coordination can dip temporarily — jump strategy may get slower even while strength rises. Compare each athlete to <b>their own trend</b>, track body mass every test (relative metrics matter more as athletes grow), and keep building strength and movement skill throughout.',
    tip: 'Note growth spurts and height changes in test notes — they explain a lot of “unexplained” changes.', refs: ['lloyd2012'] },
  { id: 'sj-dj', title: 'Squat jump, drop jump and RSI hops on OVR Force', tags: 'squat jump sj drop jump dj rsi hops 10/5 reactive eur contact time',
    body: '<b>Squat jump</b> removes the countermovement and shows concentric-only ability; compare to CMJ for the eccentric utilisation ratio (EUR = CMJ ÷ SJ height). <b>Drop jump</b>: RSI = jump height ÷ ground contact time; contact under ~250 ms reflects fast stretch-shortening ability. <b>RSI hops</b> (e.g. 10/5) test repeated reactive ability — best for ankle stiffness and elastic qualities.',
    tip: 'Only increase drop-jump box height while contact time stays under ~250 ms and RSI holds.', refs: ['mcguigan2006', 'flanagan2008'] },
];

/* ---------- Per-metric guide ---------- */
const FP_GUIDE = {
  cmj: { what: 'How high the centre of mass rose, calculated from takeoff velocity.', high: 'Better lower-body power output.', low: 'Less power output — or fatigue, poor effort, or a changed technique.', drivers: 'Propulsive impulse relative to body mass; countermovement strategy.', train: 'Strength (raise force), ballistic/jump training (express it fast), plyometrics.', reliab: 'Very reliable (CV ~3–5%).', refs: ['moir2008', 'claudino2017'] },
  takeoffVel: { what: 'Vertical velocity of the centre of mass at the instant the feet leave the plate.', high: 'More propulsive impulse per kg of body mass.', low: 'Less impulse relative to body mass.', drivers: 'Net propulsive impulse ÷ body mass.', train: 'Same as jump height; it is the cleanest outcome metric.', reliab: 'Very reliable.', refs: ['moir2008'] },
  rsiMod: { what: 'Jump height ÷ time to takeoff — how efficiently the jump is produced.', high: 'Jumps high quickly (explosive strategy).', low: 'Either low jump height or a slow, long countermovement.', drivers: 'Jump height and time to takeoff.', train: 'Plyometrics, reactive work and fast-intent ballistic training improve the time component; strength improves height.', reliab: 'Reliable; sensitive to fatigue.', refs: ['ebben2010', 'gathercole2015'] },
  ttt: { what: 'Time from the start of the movement to takeoff (unweighting + braking + propulsion).', high: 'Slower strategy — may mean fatigue or a deep/slow countermovement.', low: 'Quick, stiff strategy.', drivers: 'Countermovement depth, braking ability, intent.', train: 'Fast eccentric/plyometric work and consistent “fast” cueing.', reliab: 'Moderately reliable; a key fatigue/strategy marker.', refs: ['gathercole2015', 'bishop2022'] },
  cmDepth: { what: 'How far the centre of mass dropped during the countermovement.', high: 'Deeper dip — usually longer time to takeoff and lower peak forces, sometimes more height.', low: 'Shallow dip — usually quicker, with higher forces.', drivers: 'Athlete preference, fatigue, eccentric strength, mobility.', train: 'Not a “better/worse” metric. Use it to explain changes in forces and timing.', reliab: 'Moderate.', refs: ['bishop2022', 'mcmahon2018'] },
  brakeTime: { what: 'Duration of the braking (eccentric deceleration) phase.', high: 'Slow to stop the downward movement — possible eccentric weakness or fatigue.', low: 'Rapid deceleration.', drivers: 'Eccentric strength, stiffness, depth.', train: 'Eccentric strength (tempo eccentrics), drop landings/snap-downs, fast-SSC plyometrics.', reliab: 'Less reliable than outcome metrics — needs consistent trials.', refs: ['mcmahon2018', 'anicic2023'] },
  peakBrakeF: { what: 'Highest force during the braking phase.', high: 'Strong eccentric braking.', low: 'Weak or slow braking — or a deeper, softer strategy.', drivers: 'Eccentric strength and depth.', train: 'Eccentric strength, landing mechanics, depth drops.', reliab: 'Good.', refs: ['sole2018'] },
  brakeRfd: { what: 'How quickly braking force rises (eccentric deceleration RFD).', high: 'Rapid, stiff deceleration — good for change of direction and reactive sport.', low: 'Slow braking — a common hidden limiter.', drivers: 'Eccentric strength, tendon stiffness, intent, depth.', train: 'Snap-downs, drop landings, accentuated-eccentric jumps, fast eccentric squats, low drop jumps.', reliab: 'Variable (CV often >10%) — look at trends across several tests.', refs: ['mcmahon2018', 'anicic2023'] },
  brakeImp: { what: 'Force above body weight × time during braking (area of the braking phase).', high: 'More eccentric momentum absorbed — supports a bigger propulsive phase.', low: 'Less eccentric loading.', drivers: 'Unweighting speed and braking force.', train: 'Eccentric strength and faster countermovements.', reliab: 'Good.', refs: ['sole2018'] },
  propTime: { what: 'Duration of the concentric push.', high: 'Longer push — common with a deep countermovement.', low: 'Short, explosive push.', drivers: 'Depth and concentric force.', train: 'Strategy metric — interpret with depth.', reliab: 'Good.', refs: ['mcmahon2018'] },
  cmjPF: { what: 'Highest force in the propulsive phase. Also used as the CMJ value in DSI.', high: 'More concentric force expressed ballistically.', low: 'Less force expressed — or a deeper strategy.', drivers: 'Strength, depth, intent.', train: 'Heavy strength + loaded jumps.', reliab: 'Very reliable.', refs: ['sole2018', 'sheppard2011'] },
  propImp: { what: 'Force × time during propulsion — directly determines takeoff velocity.', high: 'More momentum at takeoff → higher jump.', low: 'Less momentum.', drivers: 'Propulsive force and time.', train: 'Strength + power; this is the “engine” metric.', reliab: 'Very reliable.', refs: ['sole2018', 'cormie2009'] },
  cmjPP: { what: 'Highest power (force × velocity) during propulsion.', high: 'More power.', low: 'Less power.', drivers: 'Force and velocity together.', train: 'Loaded and unloaded jumps, Olympic derivatives.', reliab: 'Reliable.', refs: ['cormie2009'] },
  cmjRelPP: { what: 'Peak power ÷ body mass.', high: 'More power per kg — tracks jump height closely.', low: 'Less power per kg.', drivers: 'Power and body mass.', train: 'Power training; monitor body-mass changes.', reliab: 'Reliable.', refs: ['cormie2009'] },
  peakLandF: { what: 'Highest force on landing.', high: 'Stiff or poorly absorbed landing (or simply a higher jump).', low: 'Soft landing.', drivers: 'Jump height, landing technique.', train: 'Landing mechanics and eccentric strength.', reliab: 'Variable — technique-dependent.', refs: ['mcmahon2018'] },
  brakeAsym: { what: 'Left vs right difference in braking.', high: 'One limb doing more of the deceleration — common after injury.', low: 'Balanced braking.', drivers: 'Injury history, strength differences, habit.', train: 'Unilateral eccentric strength and landing work for the weaker side.', reliab: 'Variable — confirm across sessions.', refs: ['bishop2018'] },
  propAsym: { what: 'Left vs right difference in propulsion.', high: 'One limb producing more push.', low: 'Balanced.', drivers: 'Strength differences, injury.', train: 'Unilateral strength and power for the weaker side.', reliab: 'Variable — confirm across sessions.', refs: ['bishop2018'] },
  landAsym: { what: 'Left vs right difference on landing.', high: 'Favouring one limb when absorbing force.', low: 'Balanced landing.', drivers: 'Confidence, injury history, technique.', train: 'Landing mechanics, unilateral eccentric work.', reliab: 'Variable.', refs: ['bishop2018'] },
  imtpPF: { what: 'Maximal isometric force (whole-body strength).', high: 'Strong.', low: 'Strength is a limiter.', drivers: 'Maximal strength, set-up consistency.', train: 'Heavy strength training (≈80–90% 1RM).', reliab: 'Very reliable.', refs: ['comfort2019'] },
  imtpRel: { what: 'Peak force ÷ body mass.', high: 'Strong relative to size — matters for sprinting and jumping.', low: 'Strength-to-mass is a limiter.', drivers: 'Strength and body mass.', train: 'Strength training; monitor body composition.', reliab: 'Very reliable.', refs: ['thomas2015'] },
  imtpF100: { what: 'Force produced in the first 100 ms of the pull — early, rapid force.', high: 'Explosive early force.', low: 'Slow to produce force.', drivers: 'Neural drive, intent, tendon stiffness, max strength.', train: 'Ballistic training, fast-intent isometrics, Olympic derivatives; stronger athletes also gain early force.', reliab: 'Moderate — needs strict pre-tension.', refs: ['comfort2019'] },
  imtpRfd: { what: 'Rate of force development over the reported window.', high: 'Rapid force production.', low: 'Slow force production.', drivers: 'Same as F100.', train: 'Ballistic and fast-intent work.', reliab: 'Lower than peak force; use trends.', refs: ['comfort2019'] },
  imtpTtpf: { what: 'Time to reach peak force.', high: '—', low: '—', drivers: 'Pull strategy.', train: 'Low practical value — use F100/RFD instead.', reliab: 'Poor.', refs: ['comfort2019'] },
  imtpImp: { what: 'Force × time over a set window of the pull.', high: 'More force over time.', low: 'Less.', drivers: 'Strength and rate.', train: 'Strength and rapid-force work.', reliab: 'Good over longer windows.', refs: ['comfort2019'] },
  imtpAvgF: { what: 'Average force during the pull.', high: 'Sustained force.', low: 'Less sustained force.', drivers: 'Strength.', train: 'Strength training.', reliab: 'Good.', refs: ['comfort2019'] },
  imtpAsym: { what: 'Left vs right difference in the isometric pull.', high: 'Strength imbalance.', low: 'Balanced.', drivers: 'Strength differences, injury.', train: 'Unilateral strength for the weaker side.', reliab: 'Moderate.', refs: ['bishop2018'] },
  sj: { what: 'Concentric-only jump from a held squat.', high: 'Strong concentric power.', low: 'Concentric power limiter.', drivers: 'Strength and power.', train: 'Strength, squat jumps, loaded jumps.', reliab: 'Reliable if no dip.', refs: ['mcguigan2006'] },
  djRsi: { what: 'Drop jump height ÷ contact time.', high: 'Strong fast stretch-shortening ability.', low: 'Reactive limiter.', drivers: 'Stiffness, eccentric strength, technique.', train: 'Pogo/hurdle hops, low drop jumps.', reliab: 'Moderate–good.', refs: ['flanagan2008'] },
  rsi105: { what: 'Repeated hop RSI (best 5 of 10 hops).', high: 'Elastic, stiff ankles.', low: 'Elastic limiter.', drivers: 'Ankle stiffness, reactive strength.', train: 'Pogo hops, line hops, low-amplitude plyometrics.', reliab: 'Good.', refs: ['flanagan2008'] },
};

/* ---------- Data analyzer: patterns + what's missing ---------- */
function fpAnalyze(a) {
  const T = today();
  const tests = testsFor(a.id);
  const fpKeys = METRICS.filter(m => ['cmjfp', 'iso', 'land'].includes(m.cat)).map(m => m.key).concat(['cmj', 'sj', 'vj', 'djRsi', 'djGct', 'rsi105']);
  const fpTests = tests.filter(t => fpKeys.some(k => t.m?.[k] != null));
  const latest = fpTests[fpTests.length - 1];
  const out = { latest, n: fpTests.length, sections: [], missing: [], priorities: [] };
  if (!latest) return out;
  const L = testMetrics(latest);
  const ser = k => metricSeries(a.id, k);
  const vsPrior = k => {
    const s = ser(k);
    if (s.length < 2 || s[s.length - 1].id !== latest.id) return null;
    const prior = s.slice(-4, -1).map(p => p.v);
    const ref = mean(prior);
    return { v: s[s.length - 1].v, ref, pct: (s[s.length - 1].v - ref) / Math.abs(ref) * 100, n: prior.length };
  };
  const sig = (k, ch) => ch && M[k].te != null && Math.abs(ch.pct) >= M[k].te;
  const line = (k, ch) => `${M[k].label}: ${fmtMetric(M[k], ch.v)} vs ${fmtMetric(M[k], ch.ref)} recent avg (${ch.pct > 0 ? '+' : ''}${fmtNum(ch.pct, 1)}%)`;
  const sec = (title, items) => { if (items.length) out.sections.push({ title, items }); };
  const F = (level, title, text, refs = [], action = '') => ({ level, title, text, refs, action });

  /* Output */
  const outI = [];
  ['cmj', 'takeoffVel', 'cmjRelPP'].forEach(k => {
    const ch = vsPrior(k);
    if (sig(k, ch)) outI.push(F(ch.pct * M[k].dir > 0 ? 'good' : 'warn', `${M[k].label} ${ch.pct > 0 ? 'up' : 'down'} ${fmtNum(Math.abs(ch.pct), 1)}%`, line(k, ch) + ' — beyond typical test noise.', ['hopkins2000']));
  });
  sec('Output — how high', outI);

  /* Strategy */
  const stI = [];
  const jh = vsPrior('cmj'), tt = vsPrior('ttt'), mr = vsPrior('rsiMod'), dp = vsPrior('cmDepth'), bt = vsPrior('brakeTime'), br = vsPrior('brakeRfd');
  if (jh && !sig('cmj', jh) && ((tt && tt.pct >= M.ttt.te) || (mr && mr.pct <= -M.rsiMod.te))) {
    stI.push(F('warn', 'Jump height held, but the jump got slower', `${tt ? line('ttt', tt) + '. ' : ''}${mr ? line('rsiMod', mr) + '. ' : ''}Height is within normal noise, so the athlete is “finding” the same height with a slower strategy — a classic sign of hidden neuromuscular fatigue.`, ['gathercole2015', 'bishop2022'], 'Check sleep, soreness and recent load. Reduce high-intensity plyometric and sprint volume for 48–72 h and retest before progressing.'));
  } else if (mr && sig('rsiMod', mr)) {
    stI.push(F(mr.pct > 0 ? 'good' : 'warn', `mRSI ${mr.pct > 0 ? 'improved' : 'declined'} ${fmtNum(Math.abs(mr.pct), 1)}%`, line('rsiMod', mr) + '.', ['ebben2010']));
  }
  if (dp && Math.abs(dp.pct) >= 10) stI.push(F('info', `Countermovement depth ${dp.pct > 0 ? 'deeper' : 'shallower'} by ${fmtNum(Math.abs(dp.pct), 0)}%`, `${line('cmDepth', dp)}. Depth changes alter forces and timing on their own — ${dp.pct > 0 ? 'a deeper dip usually lowers peak forces and lengthens time to takeoff' : 'a shallower dip usually raises peak forces and shortens time to takeoff'}. Interpret force changes in this test with that in mind.`, ['bishop2022', 'mcmahon2018']));
  if (L.ttt != null && L.cmj != null && L.rsiMod != null && L.rsiMod < 0.4 && L.ttt > 0.85) stI.push(F('info', 'Slow, long jump strategy', `Time to takeoff ${fmtNum(L.ttt, 3)} s with mRSI ${fmtNum(L.rsiMod, 2)}. The athlete takes a long time to produce their jump.`, ['ebben2010', 'bishop2022'], 'Add fast-SSC work (pogo hops, hurdle hops, low drop jumps) and cue “fast down, fast up”. Re-check that the cue used in testing is the same each time.'));
  sec('Strategy — how they jump', stI);

  /* Braking */
  const bI = [];
  if (br && sig('brakeRfd', br)) bI.push(F(br.pct > 0 ? 'good' : 'warn', `Braking RFD ${br.pct > 0 ? 'up' : 'down'} ${fmtNum(Math.abs(br.pct), 0)}%`, line('brakeRfd', br) + '. Braking RFD is variable, so confirm the trend over 2–3 tests.', ['mcmahon2018', 'anicic2023'], br.pct < 0 ? 'Add eccentric emphasis: snap-downs, drop landings, accentuated-eccentric jumps, controlled-tempo eccentric squats.' : ''));
  if (bt && sig('brakeTime', bt) && bt.pct > 0) bI.push(F('warn', `Braking phase ${fmtNum(bt.pct, 0)}% longer`, line('brakeTime', bt) + '. Taking longer to stop the downward movement suggests reduced eccentric capacity or fatigue.', ['mcmahon2018'], 'Prioritise eccentric strength and fast-deceleration drills; retest when fresh.'));
  if (L.relBrakeF != null && L.relPropF != null && L.relBrakeF < L.relPropF * 0.75) bI.push(F('info', 'Braking force well below propulsive force', `Peak braking ${fmtNum(L.relBrakeF, 1)} N/kg vs propulsive ${fmtNum(L.relPropF, 1)} N/kg. The athlete brakes softly and generates most force on the way up.`, ['sole2018', 'mcmahon2018'], 'If faster, stiffer jumps are the goal, develop eccentric braking (snap-downs, depth drops) — higher braking forces support a bigger, quicker propulsive phase.'));
  sec('Braking — eccentric deceleration', bI);

  /* Propulsion */
  const pI = [];
  const pi = vsPrior('propImp'), pf = vsPrior('cmjPF');
  if (pi && sig('propImp', pi)) pI.push(F(pi.pct > 0 ? 'good' : 'warn', `Propulsive impulse ${pi.pct > 0 ? 'up' : 'down'} ${fmtNum(Math.abs(pi.pct), 1)}%`, line('propImp', pi) + '. Impulse is what determines takeoff velocity.', ['sole2018']));
  if (pf && sig('cmjPF', pf) && jh && !sig('cmj', jh) && pf.pct > 0) pI.push(F('info', 'More peak force without more height', `${line('cmjPF', pf)}, but jump height is unchanged. Force is likely being produced over a shorter time (shallower dip) — check depth and propulsive time before calling it a strength gain.`, ['sole2018', 'cormie2009']));
  sec('Propulsion — concentric push', pI);

  /* Isometric */
  const iI = [];
  const ip = vsPrior('imtpPF');
  if (ip && sig('imtpPF', ip)) iI.push(F(ip.pct > 0 ? 'good' : 'warn', `Isometric peak force ${ip.pct > 0 ? 'up' : 'down'} ${fmtNum(Math.abs(ip.pct), 1)}%`, line('imtpPF', ip) + '.', ['comfort2019']));
  if (L.f100Pct != null) {
    const s = ser('f100Pct');
    if (L.f100Pct < 50 && s.length) iI.push(F('info', `Early force is ${fmtNum(L.f100Pct, 0)}% of peak force`, `Force at 100 ms is ${fmtMetric(M.imtpF100, L.imtpF100)} of a ${fmtMetric(M.imtpPF, L.imtpPF)} peak. The athlete is strong but slow to switch force on.`, ['comfort2019', 'suchomel2016'], 'Add rapid-force work: ballistic jumps, fast-intent short isometrics (1–2 s “as fast as possible”), Olympic-lift derivatives.'));
  }
  if (L.dsi != null) iI.push(F(L.dsi < 0.6 || L.dsi > 0.8 ? 'warn' : 'info', `DSI ${fmtNum(L.dsi, 2)} — ${L.dsi < 0.6 ? 'ballistic emphasis' : L.dsi > 0.8 ? 'maximal strength emphasis' : 'balanced'}`, `CMJ peak force is ${Math.round(L.dsi * 100)}% of ${latest.isoType === 'ISQ' ? 'isometric squat' : 'IMTP'} peak force.`, ['sheppard2011', 'comfort2018'], L.dsi < 0.6 ? 'Emphasise ballistic work — loaded/unloaded jumps, trap-bar jumps at ~20–40% 1RM, Olympic-lift derivatives, plyometrics — while maintaining heavy strength.' : L.dsi > 0.8 ? 'Emphasise maximal strength (≈80–90% 1RM, 2–5 reps) while keeping plyometric exposure.' : 'Keep a concurrent approach (heavy strength + ballistic work) and re-assess DSI next block.'));
  sec('Isometric strength & rapid force', iI);

  /* Asymmetry */
  const aI = [];
  const sides = {};
  ASYM_KEYS.forEach(k => { if (L[k] != null) sides[k] = latest.sides?.[k] || (k === 'asym' ? latest.asymSide : ''); });
  const big = ASYM_KEYS.filter(k => L[k] != null && L[k] >= 10);
  big.forEach(k => aI.push(F(L[k] >= 15 ? 'alert' : 'warn', `${M[k].label} ${fmtNum(L[k], 1)}%${sides[k] ? ` (${sides[k]} greater)` : ''}`, L[k] >= 15 ? 'Above 15% — a priority to confirm and address.' : '10–15% — worth watching.', ['bishop2018'])));
  const sideVals = Object.entries(sides).filter(([k, v]) => v && L[k] >= 5);
  if (new Set(sideVals.map(x => x[1])).size > 1) aI.push(F('info', 'Asymmetry direction differs between phases', sideVals.map(([k, v]) => `${M[k].label}: ${v}`).join(' · ') + '. Different sides leading in different phases often reflects strategy or task-specific differences rather than one weak limb.', ['bishop2018b']));
  sec('Asymmetry', aI);

  /* Where they stand: the coach's high-school standards, latest test */
  const stdI = [];
  [...HS_STD, ...HS_TARGETS].forEach(s => {
    const r = stdEval(a, s.key, L[s.key], latest.date, latest.bodyMassKg);
    if (!r || r.need) return;
    const lvl = r.target ? (r.lv === 1 ? 'good' : r.lv === 0 ? 'warn' : 'info') : ['warn', 'info', 'good', 'good'][r.lv];
    stdI.push(F(lvl, `${s.label}: ${stdLvName(r)} (${stdVal(r)})`, `${s.test}${r.target ? '' : `, ${SEX_WORD[r.sex]} 14–18`}. ${stdNext(r)}.${r.target && r.lv === 0 ? ' ' + s.low : ''}${r.inAge ? '' : ' Outside ages 14–18: reference only.'}`));
  });
  if (stdI.length) out.sections.unshift({ title: 'High-school standards', items: stdI });

  /* What's missing */
  const has = k => fpTests.some(t => testMetrics(t)[k] != null);
  const miss = (cond, title, why, refs = []) => { if (cond) out.missing.push({ title, why, refs }); };
  miss(a.sex !== 'M' && a.sex !== 'F', 'The athlete’s sex', 'Needed to compare results with the boys’ or girls’ high-school standards.');
  miss(!latest.bodyMassKg, 'Body mass on the latest test', 'Relative force and power (N/kg, W/kg) and takeoff-velocity checks need body mass from the same day.', ['mcmahon2018']);
  miss(!has('rsiMod') && !has('ttt'), 'mRSI / time to takeoff', 'Without a timing metric you can’t tell whether jump height was produced quickly or slowly — the main way hidden fatigue shows up.', ['gathercole2015', 'bishop2022']);
  miss(!has('brakeRfd') && !has('peakBrakeF') && !has('brakeTime'), 'Braking (eccentric) metrics', 'Braking time, peak braking force and braking RFD describe how well the athlete decelerates — often the limiter for change of direction and reactive ability.', ['mcmahon2018']);
  miss(!has('propImp') && !has('takeoffVel'), 'Propulsive impulse or takeoff velocity', 'These are the “engine” behind jump height and are among the most reliable metrics.', ['sole2018', 'anicic2023']);
  miss(!has('cmDepth'), 'Countermovement depth', 'Depth explains many changes in force and timing. Without it, a shallower or deeper dip can look like a strength change.', ['bishop2022']);
  miss(!has('imtpPF'), 'An isometric test (IMTP)', 'Needed for maximal strength and the Dynamic Strength Index (which tells you whether to prioritise strength or speed-strength).', ['sheppard2011', 'comfort2019']);
  miss(has('imtpPF') && !has('imtpF100') && !has('imtpRfd'), 'Early force (F100 or RFD) from the IMTP', 'Peak force shows how strong; F100/RFD shows how fast that strength switches on.', ['comfort2019']);
  miss(!has('sj'), 'Squat jump', 'Pairs with the CMJ to give the eccentric utilisation ratio (how much the countermovement helps).', ['mcguigan2006']);
  miss(!has('djRsi') && !has('rsi105'), 'A reactive test (drop jump or RSI hops)', 'The CMJ is a slow stretch-shortening action; sprinting and cutting rely on fast SSC, measured by drop jumps or hops.', ['flanagan2008']);
  miss(!ASYM_KEYS.some(has), 'Asymmetry (two plates)', 'Braking and propulsive asymmetries need one plate under each foot.', ['bishop2018']);
  miss(fpTests.length < 3, 'More test history', `Only ${plural(fpTests.length, 'test')} so far. With 3+ tests the app can compare against the athlete’s own normal range rather than a single previous value.`, ['hopkins2000']);
  miss(daysBetween(latest.date, T) > 35, 'A recent test', `Last force-plate test was ${ago(latest.date)}. Weekly or bi-weekly CMJs make trends far more useful.`, ['claudino2017']);

  /* Priorities */
  const all = out.sections.flatMap(s => s.items);
  all.filter(i => i.action && (i.level === 'alert' || i.level === 'warn')).slice(0, 3).forEach(i => out.priorities.push(i.action));
  if (!out.priorities.length && L.dsi != null) out.priorities.push(L.dsi < 0.6 ? 'Ballistic and plyometric emphasis while maintaining strength.' : L.dsi > 0.8 ? 'Maximal strength emphasis while maintaining plyometric exposure.' : 'Concurrent strength + power; re-assess DSI next block.');
  return out;
}

/* ---------- View ---------- */
ROUTES.fpai = r => {
  const tab = ['analyze', 'ask', 'guide', 'standards'].includes(r.parts[0]) ? r.parts[0] : 'analyze';
  const tabs = `<nav class="tabs" style="margin-top:0">${[['analyze', 'Analyze athlete'], ['ask', 'Ask the AI'], ['guide', 'OVR metric guide'], ['standards', 'HS standards']].map(([k, l]) => `<a href="#/fpai/${k}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>`;
  const v = tab === 'ask' ? fpAsk() : tab === 'guide' ? fpGuide(r.q.q || '') : tab === 'standards' ? fpStandards() : fpAnalyzeView();
  return { title: 'Force Plate AI', body: tabs + v.body, mount: v.mount };
};

function fpAnalyzeView() {
  const list = activeAthletes().filter(a => testsFor(a.id).length);
  if (!list.some(a => a.id === UI.fp.athleteId)) UI.fp.athleteId = list[0]?.id || '';
  if (!list.length) return { body: `<div class="card">${emptyState_('activity', 'No test data yet', 'Record OVR Force results in an athlete’s Testing tab (CMJ “Jump mode” and “Force mode” sections). The analyzer then explains what the numbers mean, flags patterns and lists what’s missing.', '<a class="btn primary" href="#/athletes">Go to athletes</a>')}</div>` };
  const a = getAthlete(UI.fp.athleteId);
  const res = fpAnalyze(a);
  const finding = i => `<div class="insight ${i.level}"><div class="ic">${icon(LEVEL_ICON[i.level])}</div><div class="row-main" style="white-space:normal"><div class="in-title">${esc(i.title)}</div><div class="in-text">${esc(i.text)}</div>${i.action ? `<div class="in-action"><b>Suggestion:</b> ${esc(i.action)}</div>` : ''}${refLinks(i.refs)}</div></div>`;
  const L = res.latest ? testMetrics(res.latest) : {};
  const snapKeys = ['cmj', 'takeoffVel', 'rsiMod', 'ttt', 'cmDepth', 'brakeRfd', 'peakBrakeF', 'propImp', 'cmjPF', 'cmjRelPP', 'imtpPF', 'imtpRel', 'imtpF100', 'dsi', 'eur', 'brakeAsym', 'propAsym'].filter(k => L[k] != null);
  const body = `
    <div class="card" style="padding-bottom:6px"><div class="toolbar" style="margin:0">${sel('a', list.map(x => [x.id, athleteName(x)]), a.id, 'data-change="fpAthlete" style="flex:1" aria-label="Athlete"')}
      ${aiReady() ? `<button class="btn primary" data-act="fpAskAbout" data-id="${a.id}">${icon('bulb', 'sm')}Ask AI about this athlete</button>` : ''}</div></div>
    ${!res.latest ? `<div class="card" style="margin-top:16px">${emptyState_('activity', 'No force-plate results for this athlete', 'Add OVR Force CMJ or isometric results in their Testing tab.', `<button class="btn primary" data-act="newTest" data-athlete="${a.id}">Add test</button>`)}</div>` : `
    <div class="grid two" style="margin-top:16px">
      <div class="col">
        <div class="card"><div class="card-head"><h3>Latest force-plate snapshot</h3><span class="sub">${esc(fmtDateFull(res.latest.date))} · ${plural(res.n, 'test')} on file</span></div>
          <div class="tiles">${snapKeys.map(k => `<div class="tile"><div class="t-name">${esc(M[k].label)}</div><div class="t-val">${esc(fmtMetric(M[k], L[k], false))} <small>${esc(metricUnit(M[k]))}</small></div></div>`).join('')}</div></div>
        ${res.sections.length ? res.sections.map(s => `<div class="card"><div class="card-head"><h3>${esc(s.title)}</h3></div>${s.items.map(finding).join('')}</div>`).join('') : `<div class="card"><div class="muted small">No notable patterns in the latest test compared with this athlete’s recent results. That's useful too — keep testing consistently.</div></div>`}
      </div>
      <div class="col">
        ${res.priorities.length ? `<div class="card"><div class="card-head"><h3>Training priorities</h3></div><ol style="margin:0;padding-left:20px">${res.priorities.map(p => `<li style="margin-bottom:6px">${esc(p)}</li>`).join('')}</ol></div>` : ''}
        <div class="card"><div class="card-head"><h3>What may be missing</h3><span class="sub">${res.missing.length}</span></div>
          ${res.missing.length ? res.missing.map(m => `<div class="insight info"><div class="ic">${icon('target')}</div><div class="row-main" style="white-space:normal"><div class="in-title">${esc(m.title)}</div><div class="in-text">${esc(m.why)}</div>${refLinks(m.refs)}</div></div>`).join('') : '<div class="muted small">This athlete has a complete force-plate profile. 👏</div>'}
        </div>
        <div class="card prose small"><b>How this works:</b> the analyzer compares the latest test with the athlete's own recent average and flags changes larger than each metric's typical error, then applies published interpretation frameworks (outcome vs strategy, phase analysis, DSI, asymmetry). It never invents values. ${aiReady() ? '' : 'Connect Claude in the <a href="#/fpai/ask">Ask the AI</a> tab for free-form questions.'}</div>
      </div>
    </div>`}`;
  return { body };
}
A.fpAthlete = el => { UI.fp.athleteId = el.value; refresh(); };
A.fpAskAbout = el => { UI.fp.chatAthlete = el.dataset.id; go('#/fpai/ask'); };

/* The coach's high-school standard for a guide metric (force at 100 ms is graded relative to body weight) */
function fpStdLine(k) {
  const s = STD_BY[{ imtpF100: 'imtpF100Rel' }[k] || k];
  if (!s) return '';
  if (s.target) return `<p><b>GSP target:</b> ${esc(stdNum(s, s.lo))}–${esc(stdNum(s, s.hi))}${s.unit === '%' ? '%' : ''}.</p>`;
  const row = sx => s[sx].map((b, i) => `${STD_LV[i][1]} ${stdRange(s, b)}`).join(' · ');
  return `<p><b>GSP high-school standard (14–18)${s.net ? ', above body weight' : ''}:</b><br>Boys: ${esc(row('M'))}<br>Girls: ${esc(row('F'))}</p>`;
}
function fpStandards() {
  return { body: `<div class="card"><div class="card-head"><h3>High-school standards</h3><span class="sub">boys & girls · ages 14–18</span></div>
    <p class="muted small" style="margin-top:0">Your GSP standards. Each athlete’s profile shows a meter for every one of these results they have (Overview and Testing tabs), and the percentile page shows the level next to the GSP percentile.</p>
    <div class="std-check"><b>Evidence check</b> (what the published research and OVR’s documentation say about this chart)<ul>
      <li><b>CMJ jump height</b> and <b>IMTP peak / relative force</b> fit the published data: OVR’s high-school CMJ norms and English Football League youth IMTP results. ${refLinks(['ovrCmjNorms', 'badby2025'])}</li>
      <li><b>mRSI</b> and <b>time to takeoff</b> are marked <b>Provisional</b>: their bands don’t fit the published data. mRSI grades most athletes Good or Elite, and the Good and Elite time-to-takeoff cut-offs are faster than the data found supports. Use the GSP percentile and each athlete’s own trend for these two. ${refLinks(['sole2018rsi', 'witte2024'])}</li>
      <li><b>IMTP RFD</b> and <b>impulse</b> are marked <b>Low reliability</b>: on portable plates they were unreliable at every time point, so they don’t drive training priorities. ${refLinks(['keogh2020'])}</li>
      <li><b>Relative IMTP force</b> is net force ÷ body weight (OVR’s × BW), and <b>DSI</b> uses gross ÷ gross. Settings → Force plate says which IMTP force you type, and the app converts. ${refLinks(['ovrMetrics', 'ovrDsi'])}</li>
      <li><b>IMTP peak force in newtons</b> is graded as total force (body weight included). Only that reading makes the chart’s newton and relative bands agree at high-school body masses: boys’ Good starts at 2,300 N and 2.3 × BW, a match at 71 kg (as net force, only at 102 kg). If you type net force, the app adds body weight from the test’s body mass.</li>
      <li>No published high-school tables were found for drop landing, peak power, braking RFD or squat jump, so those bands are your coaching standards.</li></ul></div>
    ${stdTableHtml()}
    <div class="section-title">Cross-test targets</div><div class="small">${stdTargetsHtml()}</div>
    <div class="prose small" style="margin-top:14px"><b>How levels are given</b><ul>
      <li>A result reaches a level at the number where the chart starts that level, e.g. boys’ CMJ: Good from 19 in. A result that falls in a gap between two levels (e.g. 18.5 in) counts as the lower level. Results are graded as they’re shown (CMJ to 0.1 in).</li>
      <li>Lower is better for peak landing force, time to stabilisation and time to takeoff.</li>
      <li>Relative IMTP force = (force − body weight) ÷ body weight, i.e. the force added on top of standing. The chart’s numbers only fit this reading: force at 100 ms can’t be below 1 × body weight while standing on the plate. Settings → Force plate says whether you type OVR’s net or gross force, and the app converts.</li>
      <li>Relative peak landing force = peak landing force ÷ body weight. Arm swing gain = (Abalakov − CMJ) ÷ CMJ.</li>
      <li>Braking capacity index = drop-landing peak force ÷ CMJ peak propulsive force. The chart gives no target, so it’s shown as a number only. A high landing force with a slow time to stabilisation means the athlete crashes into the ground stiffly.</li>
      <li>For athletes younger than 14 or older than 18 the levels are shown for reference only.</li></ul></div></div>`, mount: null };
}
function fpGuide(q) {
  const ql = q.trim().toLowerCase();
  const match = (t) => !ql || t.toLowerCase().includes(ql);
  const topics = FP_TOPICS.filter(t => match(t.title + ' ' + t.tags + ' ' + t.body));
  const groups = [['cmjfp', 'Jump mode — CMJ metrics'], ['iso', 'Force mode — isometric metrics'], ['other', 'Other jumps']];
  const metricCard = k => {
    const g = FP_GUIDE[k], m = M[k];
    if (!g || !m || !match(m.label + ' ' + g.what + ' ' + g.train)) return '';
    return `<details class="group"><summary>${esc(m.label)} <span class="faint small">${esc(metricUnit(m) || '')}</span></summary><div class="group-body prose small" style="padding-bottom:12px">
      <p><b>What it is:</b> ${esc(g.what)}</p>
      <p><b>Higher:</b> ${esc(g.high)}<br><b>Lower:</b> ${esc(g.low)}</p>
      <p><b>Driven by:</b> ${esc(g.drivers)}</p>
      <p><b>How to train it:</b> ${esc(g.train)}</p>
      <p><b>Reliability:</b> ${esc(g.reliab)}${m.te ? ` Changes under ~${m.te}% are treated as noise in this app.` : ''}</p>
      ${fpStdLine(k)}
      ${refLinks(g.refs)}</div></details>`;
  };
  const body = `
    <div class="toolbar"><div class="searchbox grow">${icon('search', 'sm')}<input type="search" placeholder="Search: braking, fatigue, asymmetry, IMTP…" value="${esc(q)}" data-input="fpGuideSearch" aria-label="Search guide"></div></div>
    <div class="grid halves">
      <div class="col"><div class="section-title" style="margin-top:0">Key concepts</div>
        ${topics.map(t => `<details class="group" ${ql ? 'open' : ''}><summary>${esc(t.title)}</summary><div class="group-body prose small" style="padding-bottom:12px">${t.body}<div class="in-action" style="margin-top:8px"><b>Coach tip:</b> ${esc(t.tip)}</div>${refLinks(t.refs)}</div></details>`).join('') || '<div class="muted small">No matching concepts.</div>'}
      </div>
      <div class="col">${groups.map(([c, l]) => {
        const keys = c === 'other' ? ['sj', 'djRsi', 'rsi105'] : METRICS.filter(m => m.cat === c && FP_GUIDE[m.key]).map(m => m.key);
        const cards = keys.map(metricCard).join('');
        return cards ? `<div class="section-title" style="margin-top:0">${esc(l)}</div>${cards}` : '';
      }).join('')}</div>
    </div>`;
  return { body, mount() { const i = $('[data-input="fpGuideSearch"]'); if (q && i) { i.focus(); i.setSelectionRange(q.length, q.length); } } };
}
A.fpGuideSearch = debounce(el => { location.replace('#/fpai/guide?q=' + encodeURIComponent(el.value)); }, 350);

/* ---------- Ask the AI (Claude via the coach's own API key) ---------- */
let AI_KEY = null;
const AI_MODEL = 'claude-opus-5-5';
function aiReady() { return !!AI_KEY; }
async function loadAiKey() { try { AI_KEY = (await Store.get('aiKey')) || null; } catch { AI_KEY = null; } }
const chat = { msgs: [], busy: false };

function fpAsk() {
  const athletes = activeAthletes();
  const ctxId = UI.fp.chatAthlete || '';
  const offline = !navigator.onLine;
  const body = `
    <div class="grid two">
      <div class="col">
        <div class="card" style="display:flex;flex-direction:column;min-height:420px">
          <div class="card-head" style="flex-wrap:wrap"><h3>Force plate assistant</h3>
            ${sel('ctx', [['', 'No athlete context'], ...athletes.map(a => [a.id, 'Context: ' + athleteName(a)])], ctxId, 'data-change="fpCtx" style="width:auto;min-height:34px;padding-top:5px;padding-bottom:5px" aria-label="Athlete context"')}
            ${chat.msgs.length ? '<button class="btn sm ghost" data-act="fpClear">Clear</button>' : ''}</div>
          <div id="chatLog" class="chat-log">${chat.msgs.length ? chat.msgs.map(chatBubble).join('') : `<div class="muted small" style="padding:8px 0">${aiReady() ? 'Ask anything about OVR Force metrics, how to read a result, what to test next, or how to program from the data. With an athlete selected, their test history is included.' : 'Answers come from the built-in OVR knowledge base (works offline). Connect Claude on the right for full AI answers about your athletes.'}</div>
            <div class="chips" style="margin-top:6px">${['Why did jump height stay the same but mRSI drop?', 'What does low braking RFD mean and how do I train it?', 'How should I set up the IMTP on OVR Force?', 'What should I report to parents from a CMJ?'].map(s => `<button class="chip" data-act="fpSuggest" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}</div>
          <form id="chatForm" class="chat-input"><textarea name="q" rows="2" placeholder="${aiReady() ? 'Ask Claude about force plate data…' : 'Search the knowledge base…'}" ${chat.busy ? 'disabled' : ''}></textarea><button class="btn primary" type="submit" ${chat.busy ? 'disabled' : ''}>${chat.busy ? 'Thinking…' : 'Send'}</button></form>
          ${aiReady() && offline ? '<div class="small" style="color:var(--warn);margin-top:6px">You’re offline — answers will come from the built-in knowledge base until you reconnect.</div>' : ''}
        </div>
      </div>
      <div class="col">
        <div class="card"><div class="card-head"><h3>${aiReady() ? `${icon('checkCircle', 'sm')} Claude connected` : 'Connect Claude (optional)'}</h3></div>
          ${aiReady() ? `<p class="small muted">Using your Anthropic API key, stored only on this device (never in backups). Model: ${AI_MODEL}.</p><button class="btn sm danger-ghost" data-act="aiDisconnect">Remove key</button>` :
          `<p class="small muted">For free-form AI answers, paste an API key from <b>console.anthropic.com</b> (pay-as-you-go; typically a few cents per question). Without a key, the assistant answers from the built-in OVR knowledge base.</p>
           ${aiKeyFormHtml()}`}
        </div>
        <div class="card prose small"><b>Privacy:</b> nothing is sent unless you ask a question with Claude connected. Athlete names are never sent — with an athlete selected, only sport, age, sex, body mass and their test numbers go with your question, plus your training philosophy so answers match your approach.</div>
      </div>
    </div>`;
  return {
    body, mount() {
      const log = $('#chatLog'); if (log) log.scrollTop = log.scrollHeight;
      $('#chatForm')?.addEventListener('submit', e => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) askFp(q); });
      $('#chatForm textarea')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); $('#chatForm').requestSubmit(); } });
      bindAiKeyForm();
    },
  };
}
function aiKeyFormHtml() { return `<form id="aiKeyForm">${field('Anthropic API key', '<input type="password" name="key" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off">')}<button class="btn primary" type="submit">Connect</button></form>`; }
function bindAiKeyForm() {
  $('#aiKeyForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const k = e.target.key.value.trim();
    if (!/^sk-ant-[\w-]{20,}$/.test(k)) return toast('That doesn’t look like an Anthropic API key (starts with sk-ant-)', 'err');
    await Store.set('aiKey', k); AI_KEY = k; toast('Claude connected'); refresh();
  });
}
function claudeHeaders() {
  return {
    'content-type': 'application/json',
    'x-api-key': AI_KEY,
    'anthropic-version': '2026-10-21',
    'anthropic-beta': 'server-side-fallback-2026-07-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}
function chatBubble(m) {
  return `<div class="bubble ${m.role}">${m.role === 'user' ? esc(m.text) : m.html || mdLite(m.text || '')}${m.src ? `<div class="faint tiny" style="margin-top:6px">${esc(m.src)}</div>` : ''}</div>`;
}
/* Minimal, safe markdown: escape first, then bold / italics / lists / headings / paragraphs */
function mdLite(t) {
  const lines = esc(t).split('\n');
  let html = '', list = null;
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const ln of lines) {
    let m;
    if ((m = ln.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = ln.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = ln.match(/^#{1,4}\s+(.*)/))) { close(); html += `<p><b>${inline(m[1])}</b></p>`; }
    else if (ln.trim() === '') close();
    else { close(); html += `<p>${inline(ln)}</p>`; }
  }
  close();
  return html;
}
A.fpCtx = el => { UI.fp.chatAthlete = el.value; };
A.fpClear = () => { chat.msgs = []; refresh(); };
A.fpSuggest = el => askFp(el.dataset.q);
A.aiDisconnect = async () => { if (!(await confirmBox('Remove your API key from this device?', '', { ok: 'Remove' }))) return; await Store.set('aiKey', null); AI_KEY = null; refresh(); };

function kbSearch(q) {
  const words = q.toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'what', 'does', 'how', 'why', 'for', 'with', 'should', 'mean', 'when', 'this', 'that', 'from', 'are', 'can', 'did', 'but', 'stay', 'same'].includes(w));
  const score = txt => { const t = txt.toLowerCase(); return words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0); };
  const items = [
    ...FP_TOPICS.map(t => ({ s: score(t.title + ' ' + t.tags) * 2 + score(t.body), html: `<p><b>${esc(t.title)}</b></p>${t.body}<p><b>Coach tip:</b> ${esc(t.tip)}</p>${refLinks(t.refs)}` })),
    ...Object.entries(FP_GUIDE).filter(([k]) => M[k]).map(([k, g]) => ({ s: score(M[k].label) * 3 + score(g.what + ' ' + g.train + ' ' + g.drivers), html: `<p><b>${esc(M[k].label)}</b> — ${esc(g.what)}</p><p><b>Higher:</b> ${esc(g.high)} <b>Lower:</b> ${esc(g.low)}</p><p><b>How to train it:</b> ${esc(g.train)}</p>${refLinks(g.refs)}` })),
  ].filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 2);
  return items.length ? items.map(x => x.html).join('<hr class="sep">') : '<p>I couldn’t find that in the built-in guide. Try terms like <i>braking</i>, <i>mRSI</i>, <i>asymmetry</i>, <i>IMTP</i>, <i>fatigue</i> or <i>protocol</i>.</p>';
}

function athleteContext(aid) {
  const a = getAthlete(aid);
  if (!a) return '';
  const tests = testsFor(aid).slice(-8);
  const keys = METRICS.filter(m => tests.some(t => testMetrics(t)[m.key] != null)).map(m => m.key);
  const rows = tests.map(t => { const m = testMetrics(t); return `${t.date}: ` + keys.filter(k => m[k] != null).map(k => `${M[k].label}=${fmtNum(metricDisp(M[k], m[k]), M[k].kind === 'len' ? 1 : Math.max(M[k].dec, 2))}${metricUnit(M[k]) ? ' ' + metricUnit(M[k]) : ''}`).join('; ') + (t.sides && Object.keys(t.sides).length ? ` | greater side: ${Object.entries(t.sides).map(([k, v]) => `${M[k]?.label} ${v}`).join(', ')}` : '') + (t.isoType && t.m?.imtpPF != null ? ` | isometric test: ${t.isoType}` : ''); });
  const an = fpAnalyze(a);
  return `ATHLETE CONTEXT (name withheld): sport ${a.sport || 'unknown'}${a.position ? ' (' + a.position + ')' : ''}; age ${ageFrom(a.dob) ?? 'unknown'}; sex ${a.sex || 'unknown'}; body mass ${a.massKg ? fmtMass(a.massKg) : 'unknown'}.
Goals: ${a.goals || '—'}. Injury notes: ${a.injuries || '—'}.
Test history (oldest→newest, units as shown):
${rows.join('\n') || 'none'}
High-school standard levels (latest result of each): ${athStdSummary(a).join('; ') || 'none graded'}.
App analyzer findings: ${an.sections.flatMap(s => s.items.map(i => i.title)).join('; ') || 'none'}.
Data gaps flagged: ${an.missing.map(m => m.title).join('; ') || 'none'}.`;
}
function aiSystemPrompt() {
  const kb = FP_TOPICS.map(t => `## ${t.title}\n${t.body.replace(/<[^>]+>/g, ' ')}\nTip: ${t.tip}`).join('\n\n');
  const guide = Object.entries(FP_GUIDE).filter(([k]) => M[k]).map(([k, g]) => `- ${M[k].label}: ${g.what} Higher: ${g.high} Lower: ${g.low} Train: ${g.train} Reliability: ${g.reliab}`).join('\n');
  return `You are the force-plate specialist inside ${S.settings.businessName || 'a sports performance coach'}'s private coaching app. The coach uses OVR Force plates (OVR Performance): Jump mode (CMJ, squat jump, drop jump, RSI hops) and Force mode (isometric mid-thigh pull, isometric squat, calf isometric); 1000 Hz; two plates give asymmetry. Help the coach interpret metrics, spot patterns and gaps in the data, and turn findings into practical training decisions.

How to answer:
- Be practical and concise; lead with the answer, then the reasoning. Use short bullet lists.
- Separate outcome (how high) from strategy (how): read jump height alongside mRSI/time to takeoff, depth and braking metrics.
- Treat changes smaller than a metric's typical error as noise. Prefer the athlete's own trend over population norms; if you give a norm, say how uncertain it is.
- If the data can't answer the question, say what test or metric is missing.
- Most athletes are youth (10–18): consider growth and maturation.
- Cite well-known research where relevant (author, year). Don't invent studies, numbers or OVR features; if unsure how OVR computes something, say so.
- You don't diagnose injuries; suggest referral when something looks clinical.
- Your scope is force-plate testing and using it in training. If a question is mainly about something else, answer briefly and suggest the Research AI section of the app, which searches, reads and cites the research.

Coach's own GSP high-school standards (ages 14–18; Poor / Average / Good / Elite). When you judge an athlete's level, use these and say they are the coach's standards, not published norms. A result reaches a level at the number where that level starts; results in a gap count as the lower level. Relative IMTP forces are (force − body weight) ÷ body weight.
${stdPromptText()}

Coach's training philosophy (align recommendations with it):
${philosophyText()}

Reference knowledge:
${kb}

Metric guide:
${guide}`;
}

async function askFp(q) {
  if (chat.busy) return;
  chat.msgs.push({ role: 'user', text: q });
  if (!aiReady() || !navigator.onLine) {
    chat.msgs.push({ role: 'assistant', html: kbSearch(q), src: aiReady() ? 'Offline — answered from the built-in knowledge base' : 'From the built-in OVR knowledge base' });
    return refresh();
  }
  chat.busy = true;
  const reply = { role: 'assistant', text: '', src: '' };
  chat.msgs.push(reply);
  refresh();
  const ctx = UI.fp.chatAthlete ? athleteContext(UI.fp.chatAthlete) : '';
  const history = chat.msgs.slice(0, -1).slice(-10).filter(m => m.text).map(m => ({ role: m.role, content: m.text }));
  if (ctx && history.length) history[history.length - 1] = { role: 'user', content: `${ctx}\n\nQUESTION: ${q}` };
  try {
    await streamClaude(aiSystemPrompt(), history, txt => {
      reply.text = txt;
      const last = $('#chatLog .bubble.assistant:last-child');
      if (last) { last.innerHTML = mdLite(txt); const log = $('#chatLog'); log.scrollTop = log.scrollHeight; }
    });
    reply.src = 'Claude · check important decisions against the cited research';
  } catch (e) {
    console.error(e);
    reply.text = '';
    reply.html = `<p style="color:var(--bad)"><b>Couldn’t reach Claude:</b> ${esc(e.message)}</p>${kbSearch(q)}`;
    reply.src = 'Fallback: built-in knowledge base';
  }
  chat.busy = false;
  if (parseHash().name === 'fpai') refresh();
}

/* Raw HTTP (this offline, single-file app has no bundler for the SDK) */
async function streamClaude(system, messages, onText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: claudeHeaders(),
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 16000, stream: true, fallbacks: 'default', thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, system, messages }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error?.message || msg; } catch { }
    if (res.status === 401) msg = 'The API key was rejected — check it in console.anthropic.com.';
    if (res.status === 429) msg = 'Rate limited — wait a moment and try again.';
    throw new Error(msg);
  }
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '', text = '', stop = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const dataLine = chunk.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) continue;
      let ev; try { ev = JSON.parse(dataLine.slice(5)); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { text += ev.delta.text; onText(text); }
      else if (ev.type === 'message_delta' && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
      else if (ev.type === 'error') throw new Error(ev.error?.message || 'Stream error');
    }
  }
  if (stop === 'refusal' && !text) throw new Error('Claude declined to answer that request.');
  if (stop === 'max_tokens') onText(text + '\n\n*(Answer was cut off — ask a follow-up to continue.)*');
  return text;
}
