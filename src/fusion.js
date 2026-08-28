(function () {
  const LF = window.LF = window.LF || {};
  const U = LF.utils;
  const F = LF.fusion = {};

  const elementSyllables = {
    fire: ['Py','Ign','Cen','Sol','Bra'], shadow: ['Ny','Umb','Noct','Vex','Zer'], earth: ['Bro','Ter','Gor','Lith','Dor'],
    electric: ['Vol','Zek','Arc','Tek','Lux'], ice: ['Gla','Cry','Niv','Eir','Syl'], nature: ['Ver','Syl','Flora','Ygg','Rho'],
    water: ['Aby','Ner','Thal','Mar','Hyd'], sound: ['Echo','Son','Lyra','Cad','Vox'], spirit: ['Ves','Mori','Eid','Astra','Nox'],
    time: ['Ai','Chron','Ora','Kai','Ae'], beast: ['Fan','Rok','Lycan','Khan','Ur'], bio: ['Man','Chit','Vira','Xen','Kry']
  };
  const endings = ['a','on','is','yx','or','en','iel','ara','ion','ex','ys','os','ith','yn','ea','ax'];

  const mutations = [
    { id:'third-strand', name:'Troisième brin', desc:'Un élément récessif inconnu s’est réveillé.', color:'#ffffff', chance:1, stat:{control:1}, effect:'thirdElement' },
    { id:'giant-gene', name:'Gène colossal', desc:'Le corps est plus vaste, plus résistant et légèrement plus lent.', color:'#ffcb75', chance:.8, stat:{vitality:2,power:1,speed:-1}, effect:'giant' },
    { id:'phase-skin', name:'Peau phasique', desc:'Une attaque ennemie peut traverser le corps sans effet.', color:'#b7a4ff', chance:.9, stat:{speed:1,control:1}, effect:'phase' },
    { id:'twin-core', name:'Cœur jumeau', desc:'Les attaques ont une chance de se répéter sous forme d’écho.', color:'#5affdf', chance:.7, stat:{power:1}, effect:'echo' },
    { id:'unstable-crown', name:'Couronne instable', desc:'La fusion est plus puissante mais sa recharge est plus longue.', color:'#ff5f92', chance:.75, stat:{power:2,control:-1}, effect:'overload' },
    { id:'ancestral-return', name:'Retour ancestral', desc:'Un trait d’une génération antérieure domine la lignée.', color:'#ffe78f', chance:.55, stat:{vitality:1,power:1,speed:1,control:1}, effect:'ancestor' }
  ];

  function pairKey(a,b){ return [a,b].sort().join('+'); }
  F.pairKey = pairKey;

  F.getSynergy = function(parentA, parentB) {
    const key = pairKey(parentA.element, parentB.element);
    if (LF.SYNERGIES[key]) return { ...LF.SYNERGIES[key], key };
    const a = LF.ELEMENTS[parentA.element] || LF.ELEMENTS.fire;
    const b = LF.ELEMENTS[parentB.element] || LF.ELEMENTS.shadow;
    if (parentA.element === parentB.element) {
      return {
        key,
        name: `${a.name} Absolu`,
        title: `L’Héritier du ${a.name} Primordial`,
        ability: `Règne de ${a.name}`,
        desc: `Libère une forme parfaite de ${a.name.toLowerCase()} qui amplifie tous les effets parentaux.`,
        phrase: a.name.toUpperCase()
      };
    }
    const first = U.pick(['Convergence','Alliance','Paradoxe','Couronne','Nexus'], U.seeded(key));
    return {
      key,
      name: `${first} ${a.name}-${b.name}`,
      title: `L’Héritier de ${a.name} et de ${b.name}`,
      ability: `${a.name} ${b.name} : Confluence`,
      desc: `Combine ${a.name.toLowerCase()} et ${b.name.toLowerCase()} dans une décharge qui applique les deux héritages.`,
      phrase: U.pick([a.name,b.name,'HYBRID','LEGACY'], U.seeded(key+'phrase')).toUpperCase()
    };
  };

  function makeName(parentA, parentB, rng) {
    const clean = name => name.replace(/[^a-zA-ZÀ-ÿ0-9]/g,'');
    const a=clean(parentA.name), b=clean(parentB.name);
    const variants=[];
    variants.push(a.slice(0,Math.max(2,Math.ceil(a.length*.52))) + b.slice(Math.max(1,Math.floor(b.length*.45))));
    variants.push(b.slice(0,Math.max(2,Math.ceil(b.length*.48))) + a.slice(Math.max(1,Math.floor(a.length*.5))));
    variants.push(U.pick(elementSyllables[parentA.element]||['Ae'],rng)+U.pick(elementSyllables[parentB.element]||['on'],rng).toLowerCase()+U.pick(endings,rng));
    if(parentA.id===parentB.id) variants.push(`${a}${U.pick([' Prime',' II',' Nova',' Apex'],rng)}`);
    let name=U.pick(variants,rng).replace(/(.)\1\1+/gi,'$1$1');
    name=name.charAt(0).toUpperCase()+name.slice(1).toLowerCase();
    if(name.length<4) name+=U.pick(endings,rng);
    if(name.length>14) name=name.slice(0,14);
    return name;
  }

  function chooseInherited(a,b,rng,preferPresent=false){
    if(preferPresent){
      if(a && a!=='none' && (!b||b==='none')) return a;
      if(b && b!=='none' && (!a||a==='none')) return b;
    }
    return rng()<.5 ? a : b;
  }

  function makeVisual(parentA,parentB,rng) {
    const va=parentA.visual||{}, vb=parentB.visual||{};
    return {
      body: chooseInherited(va.body,vb.body,rng),
      head: chooseInherited(va.head,vb.head,rng),
      hair: chooseInherited(va.hair,vb.hair,rng,true),
      horns: rng()<.24 ? Math.max(Number(va.horns)||0,Number(vb.horns)||0) : chooseInherited(Number(va.horns)||0,Number(vb.horns)||0,rng),
      wings: chooseInherited(va.wings,vb.wings,rng,true),
      tail: chooseInherited(va.tail,vb.tail,rng,true),
      armor: chooseInherited(va.armor,vb.armor,rng),
      aura: chooseInherited(va.aura,vb.aura,rng,true)
    };
  }

  function makeColors(parentA,parentB,rng) {
    const ac=parentA.colors||['#9e7bff','#281b59','#45f3d0'];
    const bc=parentB.colors||['#45f3d0','#193c44','#ffffff'];
    const t=.32+rng()*.36;
    const primary=U.mixColor(ac[0],bc[0],t);
    const secondary=U.mixColor(ac[1],bc[1],1-t*.8);
    let accent=U.mixColor(ac[2]||ac[0],bc[2]||bc[0],.25+rng()*.5);
    if(U.distance(...Object.values(U.hexToRgb(primary)).slice(0,2),...Object.values(U.hexToRgb(accent)).slice(0,2))<20) accent=U.lighten(accent,.4);
    return [primary,secondary,accent];
  }

  function dynamicMentors(parentA,parentB) {
    return [
      { id:'parentA', name:`Élevé par ${parentA.name}`, desc:`L’influence de ${parentA.name} devient dominante.`, effect:`+2 ${LF.ELEMENTS[parentA.element].name} · Héritage A renforcé`, mods: parentA.stats, source:'A', icon:'A' },
      { id:'parentB', name:`Élevé par ${parentB.name}`, desc:`L’influence de ${parentB.name} devient dominante.`, effect:`+2 ${LF.ELEMENTS[parentB.element].name} · Héritage B renforcé`, mods: parentB.stats, source:'B', icon:'B' },
      { id:'zero', name:'Élevé par le Berceau Zéro', desc:'Les deux patrimoines sont maintenus en équilibre.', effect:'+1 Contrôle · Fusion mieux stabilisée', mods:{control:2}, source:'Z', icon:'0' }
    ];
  }
  F.getMentors = dynamicMentors;

  function mentorStatBonus(mentor, stat) {
    if (!mentor) return 0;
    if (mentor.id==='zero') return stat==='control'?2:0;
    const sourceStats=mentor.mods||{};
    const ordered=Object.entries(sourceStats).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([key])=>key);
    return ordered.includes(stat)?1:0;
  }

  function makeMutation(parentA,parentB,education,rng,generation) {
    let chance=.075 + Math.min(.11,(generation-1)*.018);
    if(education?.event==='betrayal') chance+=.025;
    if(parentA.mutation || parentB.mutation) chance+=.035;
    if(rng()>chance) return null;
    const weighted=mutations.map(m=>({value:m,weight:m.chance}));
    return U.deepClone(U.weightedPick(weighted,rng));
  }

  F.generateChild = function(parentA,parentB,education={},seedText='GENESIS') {
    if(!parentA||!parentB) throw new Error('Deux origines sont nécessaires.');
    const seed=String(seedText||'GENESIS').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,12)||'GENESIS';
    const eduKey=`${education.mentor||'zero'}:${education.discipline||'engineer'}:${education.event||'rescue'}`;
    const rng=U.seeded(`${parentA.id}|${parentB.id}|${seed}|${eduKey}`);
    const discipline=LF.DISCIPLINES.find(d=>d.id===education.discipline)||LF.DISCIPLINES[2];
    const event=LF.EVENTS.find(e=>e.id===education.event)||LF.EVENTS[0];
    const mentors=dynamicMentors(parentA,parentB);
    const mentor=mentors.find(m=>m.id===education.mentor)||mentors[2];
    const generation=Math.max(parentA.generation||0,parentB.generation||0)+1;
    const synergy=F.getSynergy(parentA,parentB);
    const mutation=makeMutation(parentA,parentB,education,rng,generation);

    const stats={};
    for(const stat of ['vitality','power','speed','control']){
      const average=((parentA.stats?.[stat]||5)+(parentB.stats?.[stat]||5))/2;
      const variance=rng()<.28?(rng()<.5?-1:1):0;
      const sameBonus=parentA.id===parentB.id && stat===Object.entries(parentA.stats).sort((a,b)=>b[1]-a[1])[0][0]?1:0;
      stats[stat]=Math.round(average)+variance+mentorStatBonus(mentor,stat)+(discipline.mods?.[stat]||0)+(event.mods?.[stat]||0)+sameBonus+(mutation?.stat?.[stat]||0);
      stats[stat]=U.clamp(stats[stat],2,13);
    }

    let element=mentor.source==='A'?parentA.element:mentor.source==='B'?parentB.element:(rng()<.5?parentA.element:parentB.element);
    let secondaryElement=element===parentA.element?parentB.element:parentA.element;
    if(element===secondaryElement){secondaryElement=chooseInherited(parentA.secondaryElement,parentB.secondaryElement,rng)||element;}
    const colors=makeColors(parentA,parentB,rng);
    const visual=makeVisual(parentA,parentB,rng);
    if(mutation?.effect==='giant') visual.body='massive';
    if(mutation?.effect==='phase') visual.aura='shadow';
    if(mutation?.effect==='thirdElement'){
      const candidates=Object.keys(LF.ELEMENTS).filter(e=>![element,secondaryElement].includes(e));
      mutation.thirdElement=U.pick(candidates,rng);
      mutation.desc=`Le ${LF.ELEMENTS[mutation.thirdElement].name.toLowerCase()} s’est réveillé comme troisième élément.`;
      colors[2]=LF.ELEMENTS[mutation.thirdElement].color;
    }

    const name=makeName(parentA,parentB,rng);
    const idHash=U.hashString(`${parentA.id}|${parentB.id}|${seed}|${eduKey}`).toString(36);
    const id=`heir_${generation}_${idHash}`;
    const originAName=parentA.name, originBName=parentB.name;
    const weakness=rng()<.5?U.deepClone(parentA.weakness):U.deepClone(parentB.weakness);
    const child={
      id, kind:'heir', generation, seed, createdAt:new Date().toISOString(),
      name, title:synergy.title, lineageName:synergy.name, phrase:synergy.phrase,
      element, secondaryElement, thirdElement:mutation?.thirdElement||null,
      stats, colors, visual, mutation,
      parents:{ a:{id:parentA.id,name:originAName,generation:parentA.generation||0}, b:{id:parentB.id,name:originBName,generation:parentB.generation||0} },
      education:{ mentor:mentor.id, mentorName:mentor.name, discipline:discipline.id, disciplineName:discipline.name, event:event.id, eventName:event.name, trait:event.trait },
      abilities:{
        basic:{name:`Trait de ${LF.ELEMENTS[element].name}`,element,desc:`Projectile hérité qui ${LF.ELEMENTS[element].verb} les cibles.`},
        parentA:{name:parentA.ability?.name||`Héritage de ${parentA.name}`,element:parentA.element,desc:parentA.ability?.desc||'Pouvoir parental transmis.'},
        parentB:{name:parentB.ability?.name||`Héritage de ${parentB.name}`,element:parentB.element,desc:parentB.ability?.desc||'Pouvoir parental transmis.'},
        fusion:{name:synergy.ability,elements:[parentA.element,parentB.element],desc:synergy.desc}
      },
      passive:{name:`${discipline.passive} — ${event.trait}`,desc:`${discipline.effect}. ${event.effect}.`},
      weakness:weakness||{name:'Instabilité héréditaire',desc:'Les pouvoirs répétés allongent légèrement les recharges.'},
      combat:{
        projectileSpeed:discipline.projectileSpeed||1,
        dashCooldown:discipline.dashCooldown||0,
        fusionCooldown:discipline.fusionCooldown||0,
        crit:(discipline.crit||0)+(event.crit||0),
        healBonus:(event.healBonus||1)*(event.healPenalty||1),
        statusResist:event.statusResist||0,
        comboWindow:event.comboWindow||1,
        mentorSource:mentor.source
      },
      rarity:mutation?'ANOMALIE':generation>=4?'HÉRITAGE ANCIEN':generation>=2?'DYNASTIQUE':'HYBRIDE STABLE',
      rarityColor:mutation?.color||(generation>=4?'#ffd56c':generation>=2?'#45f3d0':'#9e7bff'),
      legend:false, victories:0, defeats:0, bestScore:0, runHistory:[]
    };
    child.code=F.encodeChild(child);
    return child;
  };

  F.encodeChild = function(child){
    const payload={v:1,child:{...U.deepClone(child),code:undefined,runHistory:undefined}};
    return `SOA1-${U.encodeData(payload)}`;
  };

  F.decodeChild = function(code){
    const clean=String(code).trim();
    if(!clean.startsWith('SOA1-'))throw new Error('Code génétique non reconnu.');
    const payload=U.decodeData(clean.slice(5));
    if(payload?.v!==1||!payload.child?.id)throw new Error('Code génétique incomplet.');
    const child=payload.child;
    child.code=clean;
    child.runHistory=child.runHistory||[];
    return child;
  };

  F.childAsOrigin = function(child){
    return {
      id:child.id, kind:'heir', generation:child.generation||1, name:child.name, title:child.title,
      role:child.education?.disciplineName||'Héritier du Berceau',
      element:child.element, secondaryElement:child.secondaryElement,
      stats:U.deepClone(child.stats), colors:U.deepClone(child.colors), visual:U.deepClone(child.visual), mutation:U.deepClone(child.mutation),
      ability:{name:child.abilities?.fusion?.name||'Confluence héréditaire',desc:child.abilities?.fusion?.desc||'Pouvoir développé par la lignée.',icon:LF.ELEMENTS[child.element]?.symbol||'◈'},
      passive:U.deepClone(child.passive), weakness:U.deepClone(child.weakness),
      lore:`Héritier de ${child.parents?.a?.name||'origine inconnue'} et ${child.parents?.b?.name||'origine inconnue'}. ${child.legend?'Légende ayant vaincu le Progéniteur.':'Lignée encore inachevée.'}`,
      sourceChildId:child.id, legend:Boolean(child.legend)
    };
  };

  F.getAvailableOrigins = function(dynasty=[]){
    const base=LF.ORIGINS.map(origin=>U.deepClone(origin));
    const heirs=(dynasty||[]).map(F.childAsOrigin);
    return [...base,...heirs];
  };
})();
