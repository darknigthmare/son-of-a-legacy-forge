(function () {
  const LF = window.LF;
  const U = LF.utils;

  class LegacyForgeApp {
    constructor() {
      this.root = document.getElementById('screenRoot');
      this.modalLayer = document.getElementById('modalLayer');
      this.toastLayer = document.getElementById('toastLayer');
      this.statusText = document.getElementById('statusText');
      this.essenceCount = document.getElementById('essenceCount');
      this.cleanupTasks = [];
      this.activeGame = null;
      this.currentScreen = 'menu';
      this.resultHandled = false;
      this.draft = { mode:'campaign', parentA:null, parentB:null, education:{mentor:null,discipline:null,event:null}, seed:'GENESIS', child:null };
      LF.storage.load();
      LF.audio.init(LF.storage.data.settings.sound);
      this.bindGlobal();
      this.refreshMeta();
      this.showMenu();
      this.registerServiceWorker();
    }

    bindGlobal() {
      document.getElementById('homeBtn').addEventListener('click', () => {
        LF.audio.play('back');
        if (this.activeGame && !this.activeGame.ended) {
          this.confirm('Quitter la mission ?', 'La partie en cours sera enregistrée comme une défaite.', 'Quitter', () => {
            this.closeModal();
            this.activeGame.end(false);
          });
        } else this.showMenu();
      });
      document.getElementById('soundBtn').addEventListener('click', event => {
        const value = !LF.storage.data.settings.sound;
        LF.storage.data.settings.sound = value;
        LF.storage.save();
        LF.audio.setEnabled(value);
        event.currentTarget.textContent = value ? '♪' : '×';
        this.toast(value ? 'Son activé' : 'Son coupé');
      });
      document.getElementById('soundBtn').textContent = LF.storage.data.settings.sound ? '♪' : '×';
      document.getElementById('fullscreenBtn').addEventListener('click', async () => {
        try {
          if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
          else await document.exitFullscreen();
        } catch { this.toast('Le plein écran est indisponible dans ce navigateur.', 'error'); }
      });
      document.addEventListener('pointerover', event => {
        const button = event.target.closest('button,.file-label');
        if (button && !button.dataset.hovered) {
          button.dataset.hovered = '1';
          LF.audio.play('hover');
          setTimeout(() => delete button.dataset.hovered, 120);
        }
      });
      window.addEventListener('beforeunload', () => this.activeGame?.stop());
    }

    registerServiceWorker() {
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      }
    }

    template(id) {
      const template = document.getElementById(id);
      return template.content.firstElementChild.cloneNode(true);
    }

    mount(node, screenName, status) {
      this.cleanup();
      this.currentScreen = screenName;
      this.root.innerHTML = '';
      this.root.appendChild(node);
      this.statusText.textContent = status || 'BERCEAU ZÉRO — ACTIF';
      this.refreshMeta();
      window.scrollTo(0,0);
      return node;
    }

    cleanup() {
      this.cleanupTasks.splice(0).forEach(task => { try { task(); } catch {} });
      if (this.activeGame && this.currentScreen === 'game') {
        this.activeGame.stop();
        this.activeGame = null;
      }
      this.closeModal();
    }

    onCleanup(task) { this.cleanupTasks.push(task); }

    refreshMeta() {
      this.essenceCount.textContent = U.formatNumber(LF.storage.data.essence || 0);
    }

    toast(message, type='success', duration=2700) {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      this.toastLayer.appendChild(toast);
      setTimeout(() => { toast.style.opacity='0'; toast.style.transform='translateX(15px)'; }, duration-300);
      setTimeout(() => toast.remove(), duration);
    }

    showModal(content) {
      this.modalLayer.innerHTML = '';
      this.modalLayer.appendChild(content);
      this.modalLayer.classList.remove('hidden');
    }

    closeModal() {
      this.modalLayer.classList.add('hidden');
      this.modalLayer.innerHTML = '';
    }

    confirm(title, text, confirmLabel, onConfirm, danger=false) {
      const card = document.createElement('div');
      card.className = 'modal-card';
      card.innerHTML = `<p class="eyebrow">CONFIRMATION</p><h3>${U.escapeHtml(title)}</h3><p>${U.escapeHtml(text)}</p><div class="modal-actions"><button class="ghost-button modal-cancel">Annuler</button><button class="${danger?'primary-button':'secondary-button'} modal-confirm">${U.escapeHtml(confirmLabel)}</button></div>`;
      card.querySelector('.modal-cancel').addEventListener('click', () => this.closeModal());
      card.querySelector('.modal-confirm').addEventListener('click', onConfirm);
      this.showModal(card);
    }

    randomSeed() {
      const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let out='';for(let i=0;i<8;i++)out+=alphabet[Math.floor(Math.random()*alphabet.length)];
      return out;
    }

    showMenu() {
      const node = this.mount(this.template('menuTemplate'), 'menu', 'BERCEAU ZÉRO — EN ATTENTE');
      const dynasty = LF.storage.data.dynasty;
      const latest = dynasty[dynasty.length-1];
      node.querySelector('#menuDynastyCount').textContent = `${dynasty.length} héritier${dynasty.length>1?'s':''}`;
      node.querySelector('.menu-new').addEventListener('click', () => this.beginFusion('campaign'));
      node.querySelector('.menu-continue').addEventListener('click', () => {
        const saved=LF.storage.data.activeDraft;
        if(saved?.child){this.draft=U.deepClone(saved);this.showReveal();}
        else if(latest){this.beginFusion('campaign',LF.fusion.childAsOrigin(latest));}
        else this.beginFusion('campaign');
      });
      node.querySelector('.menu-lab').addEventListener('click', () => this.beginFusion('lab'));
      node.querySelector('.menu-dynasty').addEventListener('click', () => this.showDynasty());
      node.querySelector('.menu-help').addEventListener('click', () => this.showHelp());
      node.querySelector('.menu-reset').addEventListener('click', () => {
        this.confirm('Effacer toute la dynastie ?', 'Les héritiers, l’Essence, les statistiques et la progression seront définitivement supprimés.', 'Tout effacer', () => {
          LF.storage.reset();this.refreshMeta();this.closeModal();this.toast('Nouvelle sauvegarde créée.');this.showMenu();
        }, true);
      });
      const models=[];
      if(latest){
        const origins=LF.fusion.getAvailableOrigins(dynasty);
        models.push(origins.find(x=>x.id===latest.parents?.a?.id)||LF.ORIGINS[0]);
        models.push(origins.find(x=>x.id===latest.parents?.b?.id)||LF.ORIGINS[1]);
        models.push(LF.fusion.childAsOrigin(latest));
      }
      const stop=LF.render.startForgeAnimation(node.querySelector('.forge-canvas'),models);
      this.onCleanup(stop);
    }

    beginFusion(mode='campaign', presetA=null, presetB=null) {
      this.draft = {
        mode, parentA:presetA?U.deepClone(presetA):null, parentB:presetB?U.deepClone(presetB):null,
        education:{mentor:null,discipline:null,event:null}, seed:this.randomSeed(), child:null
      };
      this.showFusion();
    }

    showFusion() {
      const node=this.mount(this.template('fusionTemplate'),'fusion',this.draft.mode==='lab'?'LABORATOIRE LIBRE — SÉLECTION':'PROTOCOLE DE LIGNÉE — SÉLECTION');
      const origins=LF.fusion.getAvailableOrigins(LF.storage.data.dynasty);
      let filter='all',search='',activeSlot=this.draft.parentA&&!this.draft.parentB?'B':'A';
      const grid=node.querySelector('.roster-grid');
      const slotA=node.querySelector('.parent-slot-a'),slotB=node.querySelector('.parent-slot-b');
      const next=node.querySelector('.fusion-next');
      const importButton=document.createElement('button');
      importButton.className='ghost-button';importButton.textContent='Importer un code';
      node.querySelector('.heading-actions').insertBefore(importButton,node.querySelector('.fusion-random'));

      const renderSlot=(slot,parent,label)=>{
        const canvas=slot.querySelector('canvas'),info=slot.querySelector('.slot-info');
        slot.classList.toggle('empty',!parent);slot.style.setProperty('--slot-glow',parent?U.alphaColor(parent.colors[0],.25):'rgba(120,80,255,.18)');
        if(parent){
          LF.render.drawCard(canvas,parent,{ring:true,scale:1.03});
          info.innerHTML=`<button class="slot-remove" aria-label="Retirer">×</button><h3>${U.escapeHtml(parent.name)}</h3><div class="slot-role">${U.escapeHtml(parent.title)}</div><div class="slot-traits"><span class="mini-tag">${U.escapeHtml(LF.ELEMENTS[parent.element]?.name||parent.element)}</span><span class="mini-tag">G${parent.generation||0}</span><span class="mini-tag">${U.escapeHtml(parent.role||'Origine')}</span></div>`;
          info.querySelector('.slot-remove').addEventListener('click',event=>{event.stopPropagation();if(label==='A')this.draft.parentA=null;else this.draft.parentB=null;activeSlot=label;update();});
        } else { const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);info.innerHTML=''; }
        slot.onclick=()=>{activeSlot=label;slotA.style.outline=label==='A'?'2px solid var(--accent-2)':'';slotB.style.outline=label==='B'?'2px solid var(--accent)':'';};
      };

      const selectOrigin=origin=>{
        LF.audio.play('select');
        if(activeSlot==='A'){this.draft.parentA=U.deepClone(origin);activeSlot='B';}
        else{this.draft.parentB=U.deepClone(origin);activeSlot='A';}
        update();
      };

      const renderGrid=()=>{
        const visible=origins.filter(origin=>(filter==='all'||origin.kind===filter)&&(!search||`${origin.name} ${origin.title} ${LF.ELEMENTS[origin.element]?.name}`.toLowerCase().includes(search)));
        grid.innerHTML=visible.length?'':'<div class="empty-details">Aucune origine ne correspond à la recherche.</div>';
        for(const origin of visible){
          const card=document.createElement('button');card.className='origin-card';card.style.setProperty('--card-color',origin.colors[0]);
          if(this.draft.parentA?.id===origin.id)card.classList.add('selected-a');
          if(this.draft.parentB?.id===origin.id)card.classList.add('selected-b');
          card.innerHTML=`<canvas width="220" height="185"></canvas>${origin.generation?`<span class="card-generation">G${origin.generation}</span>`:''}<div class="origin-card-info"><strong>${U.escapeHtml(origin.name)}</strong><span>${U.escapeHtml(LF.ELEMENTS[origin.element]?.name||'Anomalie')} · ${U.escapeHtml(origin.role||'Origine')}</span></div>`;
          card.addEventListener('click',()=>selectOrigin(origin));grid.appendChild(card);LF.render.drawCard(card.querySelector('canvas'),origin,{ring:false,scale:.82});
        }
      };

      const update=()=>{
        renderSlot(slotA,this.draft.parentA,'A');renderSlot(slotB,this.draft.parentB,'B');
        next.disabled=!(this.draft.parentA&&this.draft.parentB);renderGrid();
      };
      node.querySelector('.roster-search').addEventListener('input',event=>{search=event.target.value.trim().toLowerCase();renderGrid();});
      node.querySelectorAll('.tab-button').forEach(button=>button.addEventListener('click',()=>{node.querySelectorAll('.tab-button').forEach(b=>b.classList.remove('active'));button.classList.add('active');filter=button.dataset.filter;renderGrid();}));
      node.querySelector('.fusion-random').addEventListener('click',()=>{this.draft.parentA=U.deepClone(U.pick(origins));this.draft.parentB=U.deepClone(U.pick(origins));activeSlot='A';update();LF.audio.play('select');});
      next.addEventListener('click',()=>this.showEducation());
      importButton.addEventListener('click',()=>this.showImportCodeModal());
      update();
    }

    showImportCodeModal() {
      const card=document.createElement('div');card.className='modal-card';
      card.innerHTML=`<p class="eyebrow">IMPORT GÉNÉTIQUE</p><h3>Restaurer un héritier</h3><p>Colle un code commençant par <strong>SOA1-</strong>. L’héritier importé sera ajouté à ta dynastie et pourra servir de parent.</p><textarea class="code-area" style="width:100%;min-height:140px;border:1px solid var(--line);border-radius:12px;background:rgba(0,0,0,.25);color:var(--text);padding:12px;resize:vertical" placeholder="SOA1-…"></textarea><div class="modal-actions"><button class="ghost-button cancel">Annuler</button><button class="primary-button import">Importer</button></div>`;
      card.querySelector('.cancel').addEventListener('click',()=>this.closeModal());
      card.querySelector('.import').addEventListener('click',()=>{
        try{const child=LF.fusion.decodeChild(card.querySelector('textarea').value);LF.storage.addOrUpdateHeir(child);this.closeModal();this.toast(`${child.name} a rejoint la dynastie.`);this.showFusion();}
        catch(error){this.toast(error.message,'error');}
      });
      this.showModal(card);card.querySelector('textarea').focus();
    }

    showEducation() {
      if(!this.draft.parentA||!this.draft.parentB)return this.showFusion();
      const node=this.mount(this.template('educationTemplate'),'education','PROTOCOLE DE LIGNÉE — ÉDUCATION');
      const mini=node.querySelector('.parent-miniatures');
      [this.draft.parentA,this.draft.parentB].forEach(parent=>{const div=document.createElement('div');div.className='parent-miniature';div.innerHTML='<canvas width="100" height="100"></canvas>';mini.appendChild(div);LF.render.drawPortrait(div.querySelector('canvas'),parent,{scale:1.1});});
      const mentors=LF.fusion.getMentors(this.draft.parentA,this.draft.parentB);
      const groups=[
        {id:'mentor',number:'01',name:'Mentor principal',desc:'Qui a transmis sa vision du monde ?',options:mentors},
        {id:'discipline',number:'02',name:'Discipline',desc:'Comment le corps et les pouvoirs ont-ils été entraînés ?',options:LF.DISCIPLINES},
        {id:'event',number:'03',name:'Événement fondateur',desc:'Quel souvenir définit sa personnalité ?',options:LF.EVENTS}
      ];
      const columns=node.querySelector('.education-columns');
      const render=()=>{
        columns.innerHTML='';
        for(const group of groups){
          const section=document.createElement('section');section.className='education-group';
          section.innerHTML=`<div class="education-group-head"><span>${group.number}</span><h3>${group.name}</h3><p>${group.desc}</p></div><div class="education-options"></div>`;
          const options=section.querySelector('.education-options');
          for(const option of group.options){
            const button=document.createElement('button');button.className='education-card';if(this.draft.education[group.id]===option.id)button.classList.add('selected');
            button.innerHTML=`<strong>${option.icon?`${option.icon} `:''}${U.escapeHtml(option.name)}</strong><p>${U.escapeHtml(option.desc)}</p><span class="education-effect">${U.escapeHtml(option.effect)}</span>`;
            button.addEventListener('click',()=>{this.draft.education[group.id]=option.id;LF.audio.play('select');render();});options.appendChild(button);
          }
          columns.appendChild(section);
        }
        node.querySelector('.education-forge').disabled=!this.draft.education.mentor||!this.draft.education.discipline||!this.draft.education.event;
      };
      const seedInput=node.querySelector('#seedInput');seedInput.value=this.draft.seed;
      seedInput.addEventListener('input',()=>{this.draft.seed=seedInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,12);seedInput.value=this.draft.seed;});
      node.querySelector('.seed-random').addEventListener('click',()=>{this.draft.seed=this.randomSeed();seedInput.value=this.draft.seed;LF.audio.play('select');});
      node.querySelector('.education-back').addEventListener('click',()=>this.showFusion());
      node.querySelector('.education-forge').addEventListener('click',()=>{
        try{
          this.draft.child=LF.fusion.generateChild(this.draft.parentA,this.draft.parentB,this.draft.education,this.draft.seed);
          LF.storage.setDraft(this.draft);LF.audio.play('forge');
          document.body.classList.add('forging');setTimeout(()=>{document.body.classList.remove('forging');this.showReveal();},620);
        }catch(error){this.toast(error.message,'error');}
      });
      render();
    }

    showReveal() {
      const child=this.draft.child;if(!child)return this.showEducation();
      const node=this.mount(this.template('revealTemplate'),'reveal',`HÉRITIER ${child.name.toUpperCase()} — STABLE`);
      node.querySelector('.rarity-badge').textContent=child.rarity;node.querySelector('.rarity-badge').style.color=child.rarityColor;
      node.querySelector('.child-name').textContent=child.name;node.querySelector('.child-title').textContent=child.title;
      node.querySelector('.parent-line').textContent=`Génération ${child.generation} · ${child.parents.a.name} × ${child.parents.b.name} · Trait ${child.education.trait}`;
      const statLabels={vitality:'VITALITÉ',power:'PUISSANCE',speed:'VITESSE',control:'CONTRÔLE'};
      node.querySelector('.child-stat-grid').innerHTML=Object.entries(child.stats).map(([key,value])=>`<div class="stat-tile"><small>${statLabels[key]}</small><strong>${value}</strong></div>`).join('');
      const abilities=[['CLIC',child.abilities.basic],['1',child.abilities.parentA],['2',child.abilities.parentB],['R',child.abilities.fusion]];
      node.querySelector('.ability-list').innerHTML=abilities.map(([key,a])=>`<div class="ability-row"><span class="ability-key">${key}</span><div><strong>${U.escapeHtml(a.name)}</strong><span>${U.escapeHtml(a.desc)}</span></div><em>${Array.isArray(a.elements)?a.elements.map(e=>LF.ELEMENTS[e]?.name).join(' + '):LF.ELEMENTS[a.element]?.name||'Fusion'}</em></div>`).join('');
      node.querySelector('.weakness-card').innerHTML=`<strong>FAIBLESSE — ${U.escapeHtml(child.weakness.name)}</strong><br>${U.escapeHtml(child.weakness.desc)}${child.mutation?`<br><br><strong>MUTATION — ${U.escapeHtml(child.mutation.name)}</strong><br>${U.escapeHtml(child.mutation.desc)}`:''}`;
      const stop=LF.render.startRevealAnimation(node.querySelector('.reveal-canvas'),child);this.onCleanup(stop);
      node.querySelector('.start-run').addEventListener('click',()=>this.showGame());
      node.querySelector('.copy-code').addEventListener('click',async()=>{await U.copyText(child.code);this.toast('Code génétique copié.');});
      node.querySelector('.reveal-back').addEventListener('click',()=>{this.draft.child=null;this.showFusion();});
    }

    showGame() {
      const child=this.draft.child;if(!child)return this.showMenu();
      const node=this.mount(this.template('gameTemplate'),'game',`MISSION ACTIVE — ${child.name.toUpperCase()}`);
      this.resultHandled=false;
      const canvas=node.querySelector('#gameCanvas');
      const game=new LF.ArenaGame(canvas,child,node,{
        onUpgrade:(instance,payload)=>this.showUpgradeModal(instance,payload),
        onPause:instance=>this.showPauseModal(instance),
        onEnd:result=>this.handleRunEnd(result)
      });
      this.activeGame=game;
      game.start();
    }

    showUpgradeModal(game,payload) {
      const card=document.createElement('div');card.className='modal-card';
      const realmReward=payload.reason==='realm';
      card.innerHTML=`<p class="eyebrow">${realmReward?'ADAPTATION DE ROYAUME':'MUTATION DE COMBAT'}</p><h3>${realmReward?'La lignée évolue':'Niveau '+payload.level}</h3><p>${realmReward?'La Fracture vaincue libère assez d’énergie pour stabiliser un nouveau gène.':'Choisis une modification immédiate pour la suite de cette mission.'}</p><div class="upgrade-grid"></div>`;
      const grid=card.querySelector('.upgrade-grid');
      for(const upgrade of payload.options){
        const button=document.createElement('button');button.className='upgrade-card';button.innerHTML=`<span>${upgrade.icon}</span><strong>${U.escapeHtml(upgrade.name)}</strong><small>${U.escapeHtml(upgrade.desc)}</small>`;
        button.addEventListener('click',()=>{LF.audio.play('select');this.closeModal();game.chooseUpgrade(upgrade.id);});grid.appendChild(button);
      }
      this.showModal(card);
    }

    showPauseModal(game) {
      if(game.paused&&game.pauseReason==='upgrade')return;
      game.setPaused(true,'manual');
      const card=document.createElement('div');card.className='modal-card';
      card.innerHTML=`<p class="eyebrow">MISSION SUSPENDUE</p><h3>Pause</h3><p>ZQSD/WASD pour bouger · clic pour tirer · 1 et 2 pour les héritages · R pour la fusion · Espace pour l’esquive.</p><div class="modal-actions"><button class="ghost-button abandon">Abandonner</button><button class="primary-button resume">Reprendre</button></div>`;
      card.querySelector('.resume').addEventListener('click',()=>{this.closeModal();game.setPaused(false);});
      card.querySelector('.abandon').addEventListener('click',()=>this.confirm('Abandonner la mission ?', 'L’héritier sera archivé, mais cette tentative comptera comme une défaite.', 'Abandonner', ()=>{this.closeModal();game.end(false);}, true));
      this.showModal(card);
    }

    handleRunEnd(result) {
      if(this.resultHandled)return;this.resultHandled=true;
      const child=this.draft.child;
      LF.storage.registerRun(result);
      LF.storage.addOrUpdateHeir(child,result);
      LF.storage.clearDraft();
      this.refreshMeta();
      this.showResults(result);
    }

    showResults(result) {
      const child=this.draft.child;
      const node=this.mount(this.template('resultsTemplate'),'results',result.victory?'LIGNÉE VICTORIEUSE — ARCHIVÉE':'MISSION TERMINÉE — HÉRITIER ARCHIVÉ');
      node.querySelector('.result-kicker').textContent=result.victory?'LE PROGÉNITEUR EST TOMBÉ':'LA FRACTURE A REJETÉ L’HÉRITIER';
      node.querySelector('.result-title').textContent=result.victory?'Dynastie validée':'Lignée interrompue';
      node.querySelector('.result-copy').textContent=result.victory?`${child.name} n’est plus une anomalie expérimentale : sa lignée est désormais capable de survivre à tous les royaumes connus.`:`${child.name} rejoint malgré tout les archives du Berceau. Ses gènes restent disponibles pour une nouvelle génération mieux préparée.`;
      const stats=[['SCORE',U.formatNumber(result.score)],['ÉLIMINATIONS',U.formatNumber(result.kills)],['NIVEAU',result.level],['TEMPS',U.formatTime(result.time)],['COMBO MAX',result.maxCombo],['PRÉCISION',`${result.accuracy}%`]];
      node.querySelector('.result-stats').innerHTML=stats.map(([label,value])=>`<div class="result-stat"><small>${label}</small><strong>${value}</strong></div>`).join('');
      node.querySelector('.result-rewards').innerHTML=`<strong>◆ +${U.formatNumber(result.essence)} ESSENCE DYNASTIQUE</strong><br>${result.victory?'Statut Légende obtenu. Cet héritier transmettra une lignée prestigieuse.':'L’héritier est sauvegardé et peut immédiatement devenir parent.'}`;
      const actions=node.querySelector('.result-actions');
      actions.innerHTML=`<button class="primary-button next-gen">Nouvelle génération <span>→</span></button><button class="secondary-button replay">Rejouer cet héritier</button><button class="ghost-button tree">Voir la dynastie</button><button class="ghost-button menu">Menu principal</button>`;
      actions.querySelector('.next-gen').addEventListener('click',()=>this.beginFusion('campaign',LF.fusion.childAsOrigin({...child,legend:result.victory||child.legend})));
      actions.querySelector('.replay').addEventListener('click',()=>this.showGame());
      actions.querySelector('.tree').addEventListener('click',()=>this.showDynasty(child.id));
      actions.querySelector('.menu').addEventListener('click',()=>this.showMenu());
      const stop=LF.render.startRevealAnimation(node.querySelector('.results-visual canvas'),child,'result');this.onCleanup(stop);
    }

    showDynasty(preselectId=null) {
      const node=this.mount(this.template('dynastyTemplate'),'dynasty','ARCHIVES DU BERCEAU — CONSULTATION');
      const dynasty=LF.storage.data.dynasty;
      const stats=LF.storage.data.statistics;
      const summary=[['HÉRITIERS',dynasty.length],['GÉNÉRATION MAX',`G${stats.highestGeneration||0}`],['VICTOIRES',stats.victories||0],['MEILLEUR SCORE',U.formatNumber(stats.bestScore||0)],['MUTATIONS',stats.mutationsFound?.length||0]];
      node.querySelector('.dynasty-summary').innerHTML=summary.map(([l,v])=>`<div class="summary-tile"><small>${l}</small><strong>${v}</strong></div>`).join('');
      const lanes=node.querySelector('.generation-lanes'),details=node.querySelector('.dynasty-details');
      if(!dynasty.length){lanes.innerHTML='<div class="empty-details"><h3>Aucune lignée enregistrée</h3><p>Forge deux origines et lance une mission pour créer le premier héritier.</p><button class="primary-button empty-new">Créer le premier héritier</button></div>';lanes.querySelector('.empty-new').addEventListener('click',()=>this.beginFusion('campaign'));}
      const groups=new Map();for(const child of dynasty){const g=child.generation||1;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(child);}
      for(const [generation,children] of [...groups.entries()].sort((a,b)=>a[0]-b[0])){
        const lane=document.createElement('section');lane.className='generation-lane';lane.innerHTML=`<div class="generation-lane-head">GÉNÉRATION ${generation}</div><div class="generation-cards"></div>`;
        const cards=lane.querySelector('.generation-cards');
        for(const child of children){
          const button=document.createElement('button');button.className='heir-node';button.dataset.id=child.id;button.innerHTML=`<canvas width="210" height="170"></canvas><div><strong>${U.escapeHtml(child.name)}</strong><span>${child.legend?'LÉGENDE · ':''}${U.escapeHtml(child.lineageName||'Lignée hybride')}</span></div>`;
          button.addEventListener('click',()=>showDetails(child));cards.appendChild(button);LF.render.drawCard(button.querySelector('canvas'),child,{ring:false,scale:.76});
        }
        lanes.appendChild(lane);
      }
      const showDetails=child=>{
        lanes.querySelectorAll('.heir-node').forEach(card=>card.classList.toggle('selected',card.dataset.id===child.id));
        details.innerHTML=`<div class="detail-portrait"><canvas width="400" height="350"></canvas>${child.legend?'<span class="legend-stamp">LÉGENDE</span>':''}</div><div class="detail-body"><p class="eyebrow">GÉNÉRATION ${child.generation}</p><h3>${U.escapeHtml(child.name)}</h3><div class="detail-title">${U.escapeHtml(child.title)}</div><div class="detail-parents">${U.escapeHtml(child.parents?.a?.name||'?')} × ${U.escapeHtml(child.parents?.b?.name||'?')}<br>${U.escapeHtml(child.education?.disciplineName||'Éducation inconnue')} · ${U.escapeHtml(child.education?.trait||'Trait inconnu')}</div><div class="child-stat-grid">${Object.entries(child.stats||{}).map(([k,v])=>`<div class="stat-tile"><small>${({vitality:'VITALITÉ',power:'PUISSANCE',speed:'VITESSE',control:'CONTRÔLE'})[k]||k.toUpperCase()}</small><strong>${v}</strong></div>`).join('')}</div>${child.mutation?`<div class="weakness-card"><strong>${U.escapeHtml(child.mutation.name)}</strong><br>${U.escapeHtml(child.mutation.desc)}</div>`:''}<div class="detail-actions"><button class="primary-button use-parent">Utiliser comme parent A</button><button class="secondary-button copy">Copier le code génétique</button><button class="ghost-button delete">Supprimer des archives</button></div></div>`;
        LF.render.drawCard(details.querySelector('canvas'),child,{ring:true,scale:.95});
        details.querySelector('.use-parent').addEventListener('click',()=>this.beginFusion('campaign',LF.fusion.childAsOrigin(child)));
        details.querySelector('.copy').addEventListener('click',async()=>{await U.copyText(child.code||LF.fusion.encodeChild(child));this.toast('Code génétique copié.');});
        details.querySelector('.delete').addEventListener('click',()=>this.confirm(`Supprimer ${child.name} ?`,'Cette branche disparaîtra des choix de parents. Les descendants déjà créés resteront archivés.','Supprimer',()=>{LF.storage.removeHeir(child.id);this.closeModal();this.showDynasty();},true));
      };
      node.querySelector('.dynasty-new').addEventListener('click',()=>this.beginFusion('campaign'));
      node.querySelector('.dynasty-export').addEventListener('click',()=>U.download(`legacy-forge-save-${new Date().toISOString().slice(0,10)}.json`,LF.storage.export(),'application/json'));
      node.querySelector('.dynasty-import').addEventListener('change',async event=>{
        const file=event.target.files?.[0];if(!file)return;
        try{LF.storage.import(await file.text());this.toast('Sauvegarde importée.');this.showDynasty();}catch(error){this.toast(error.message,'error');}
      });
      if(dynasty.length)showDetails(dynasty.find(c=>c.id===preselectId)||dynasty[dynasty.length-1]);
    }

    showHelp() {
      const node=this.mount(this.template('helpTemplate'),'help','MANUEL DU BERCEAU — OUVERT');
      node.querySelector('.help-play').addEventListener('click',()=>this.beginFusion('campaign'));
    }
  }

  window.addEventListener('DOMContentLoaded',()=>{
    window.legacyForgeApp=new LegacyForgeApp();
  });
})();
