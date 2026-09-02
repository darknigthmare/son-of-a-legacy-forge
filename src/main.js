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
      this.activeRunToken = null;
      this.modalCleanup = null;
      this.previousFocus = null;
      this.currentScreen = 'menu';
      this.resultHandled = false;
      this.draft = { mode:'campaign', parentA:null, parentB:null, education:{mentor:null,discipline:null,event:null}, seed:'GENESIS', child:null };
      LF.storage.load();
      this.applySettings();
      LF.audio.init(LF.storage.data.settings.sound);
      this.bindGlobal();
      this.refreshMeta();
      this.showMenu();
      this.registerServiceWorker();
      if(!LF.storage.data.progression?.tutorialSeen && !LF.storage.data.statistics?.runs)setTimeout(()=>this.showOnboarding(),180);
    }

    bindGlobal() {
      document.getElementById('homeBtn').addEventListener('click', () => {
        LF.audio.play('back');
        if (this.activeGame && !this.activeGame.ended) {
          if(this.activeGame.pauseReason==='upgrade'){
            this.toast('Choisis d’abord une mutation pour sécuriser la vague.', 'error');
            return;
          }
          this.activeGame.setPaused(true,'menu');
          this.confirm('Retourner au Berceau ?', 'La mission reprendra au début de la vague actuelle. Aucun résultat ne sera perdu.', 'Sauvegarder et quitter', () => {
            const game=this.activeGame;
            this.closeModal();
            game?.stop();
            this.activeGame=null;
            this.showMenu();
          }, false, ()=>this.activeGame?.setPaused(false));
        } else if(this.activeGame?.ended && !this.resultHandled) {
          this.toast('Archivage de la mission en cours…');
        } else this.showMenu();
      });
      document.getElementById('soundBtn').addEventListener('click', event => {
        const value = !LF.storage.data.settings.sound;
        LF.storage.data.settings.sound = value;
        const saved=LF.storage.save();
        const actual=Boolean(LF.storage.data.settings.sound);
        LF.audio.setEnabled(actual);
        event.currentTarget.textContent = actual ? '♪' : '×';
        event.currentTarget.setAttribute('aria-pressed',String(actual));
        this.toast(saved?(actual?'Son activé':'Son coupé'):'Le réglage n’a pas pu être enregistré.',saved?'success':'error');
      });
      document.getElementById('soundBtn').textContent = LF.storage.data.settings.sound ? '♪' : '×';
      document.getElementById('soundBtn').setAttribute('aria-pressed',String(LF.storage.data.settings.sound));
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
      window.addEventListener('storage', event=>{
        if(event.key!==LF.storage.key||this.activeGame)return;
        LF.storage.load();this.applySettings();this.refreshMeta();this.toast('Sauvegarde synchronisée depuis un autre onglet.');
        if(this.currentScreen==='menu')this.showMenu();
      });
      window.addEventListener('error',event=>{console.error(event.error||event.message);this.toast('Une erreur inattendue a été contenue. La sauvegarde reste intacte.','error');});
      window.addEventListener('unhandledrejection',event=>{console.error(event.reason);this.toast('Une opération a échoué sans endommager la dynastie.','error');});
    }

    async registerServiceWorker() {
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        try{
          const registration=await navigator.serviceWorker.register('./sw.js');
          registration.addEventListener('updatefound',()=>{
            const worker=registration.installing;
            worker?.addEventListener('statechange',()=>{
              if(worker.state==='installed'&&navigator.serviceWorker.controller)this.toast('Mise à jour prête. Elle sera active au prochain chargement.');
            });
          });
        }catch(error){console.warn('Service worker indisponible.',error);}
      }
    }

    applySettings() {
      const settings=LF.storage.data.settings||{};
      document.documentElement.classList.toggle('reduced-motion',Boolean(settings.reducedMotion));
      document.documentElement.classList.toggle('high-contrast',Boolean(settings.highContrast));
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
      if (this.activeGame) {
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

    showModal(content, options={}) {
      this.closeModal(false);
      this.previousFocus=document.activeElement;
      this.modalLayer.innerHTML = '';
      this.modalLayer.appendChild(content);
      const title=content.querySelector('h1,h2,h3');
      if(title){
        title.id=title.id||'activeModalTitle';
        this.modalLayer.setAttribute('aria-labelledby',title.id);
      }else this.modalLayer.setAttribute('aria-label','Fenêtre de dialogue');
      this.modalLayer.classList.remove('hidden');
      const keyHandler=event=>{
        if(event.key==='Escape'){
          event.preventDefault();
          event.stopPropagation();
          if(typeof options.onEscape==='function')options.onEscape();
          else if(!options.locked)this.closeModal();
          return;
        }
        if(event.key!=='Tab')return;
        const focusable=[...content.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')];
        if(!focusable.length){event.preventDefault();content.focus();return;}
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      };
      document.addEventListener('keydown',keyHandler);
      this.modalCleanup=()=>document.removeEventListener('keydown',keyHandler);
      requestAnimationFrame(()=>{(content.querySelector('[autofocus],button:not([disabled]),input:not([disabled]),textarea:not([disabled])')||content).focus();});
    }

    closeModal(restoreFocus=true) {
      this.modalCleanup?.();this.modalCleanup=null;
      this.modalLayer.classList.add('hidden');
      this.modalLayer.innerHTML = '';
      this.modalLayer.removeAttribute('aria-labelledby');
      this.modalLayer.removeAttribute('aria-label');
      if(restoreFocus&&this.previousFocus?.isConnected)this.previousFocus.focus();
      this.previousFocus=null;
    }

    confirm(title, text, confirmLabel, onConfirm, danger=false, onCancel=null) {
      const card = document.createElement('div');
      card.className = 'modal-card';card.tabIndex=-1;
      card.innerHTML = `<p class="eyebrow">CONFIRMATION</p><h3>${U.escapeHtml(title)}</h3><p>${U.escapeHtml(text)}</p><div class="modal-actions"><button class="ghost-button modal-cancel">Annuler</button><button class="${danger?'primary-button':'secondary-button'} modal-confirm">${U.escapeHtml(confirmLabel)}</button></div>`;
      const cancel=()=>{this.closeModal();onCancel?.();};
      card.querySelector('.modal-cancel').addEventListener('click',cancel);
      card.querySelector('.modal-confirm').addEventListener('click', onConfirm);
      this.showModal(card,{onEscape:cancel});
    }

    randomSeed() {
      const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let out='';for(let i=0;i<8;i++)out+=alphabet[Math.floor(Math.random()*alphabet.length)];
      return out;
    }

    persistDraft() {
      if(this.draft.mode==='lab')return true;
      const saved=LF.storage.setDraft(this.draft);
      if(saved===false)this.toast('La forge n’a pas pu être sauvegardée. Exporte la dynastie avant de quitter.','error');
      return saved;
    }

    showMenu() {
      const node = this.mount(this.template('menuTemplate'), 'menu', 'BERCEAU ZÉRO — EN ATTENTE');
      const dynasty = LF.storage.data.dynasty;
      const latest = dynasty[dynasty.length-1];
      const activeRun=LF.storage.data.activeRun;
      const saved=LF.storage.data.activeDraft;
      node.querySelector('#menuDynastyCount').textContent = `${dynasty.length} héritier${dynasty.length>1?'s':''}`;
      node.querySelector('.menu-new').addEventListener('click', () => {
        const start=()=>{if(!LF.storage.clearRunAndDraft()){this.toast('Impossible de remplacer la mission sauvegardée. Exporte la dynastie puis libère de l’espace.','error',5200);return;}this.closeModal();this.beginFusion('campaign');};
        if(activeRun)this.confirm('Abandonner la mission sauvegardée ?','Le point de reprise actuel sera supprimé. La dynastie déjà archivée restera intacte.','Nouvelle lignée',start,true);
        else start();
      });
      node.querySelector('.menu-continue').addEventListener('click', () => {
        if(activeRun&&saved?.child){this.draft=U.deepClone(saved);this.showGame(activeRun);}
        else if(saved?.child){this.draft=U.deepClone(saved);this.showReveal();}
        else if(latest){this.beginFusion('campaign',LF.fusion.childAsOrigin(latest));}
      });
      const continueButton=node.querySelector('.menu-continue');
      if(activeRun&&saved?.child){
        continueButton.textContent='Reprendre la mission — vague '+Math.max(1,Number(activeRun.wave)||1);
      }else if(saved?.child)continueButton.textContent='Reprendre la forge';
      else if(latest)continueButton.textContent='Continuer avec '+latest.name;
      else{
        continueButton.textContent='Aucune lignée à continuer';
        continueButton.disabled=true;
      }
      node.querySelector('.menu-lab').addEventListener('click', () => this.beginFusion('lab'));
      node.querySelector('.menu-dynasty').addEventListener('click', () => this.showDynasty());
      node.querySelector('.menu-legacy').addEventListener('click',()=>this.showLegacy());
      node.querySelector('.menu-help').addEventListener('click', () => this.showHelp());
      node.querySelector('.menu-settings').addEventListener('click',()=>this.showSettings());
      node.querySelector('.menu-reset').addEventListener('click', () => {
        this.confirm('Effacer toute la dynastie ?', 'Les héritiers, l’Essence, les statistiques et la progression seront définitivement supprimés.', 'Tout effacer', () => {
          if(!LF.storage.reset()){this.toast('La réinitialisation a échoué : les données existantes ont été conservées.','error',5200);return;}
          this.applySettings();LF.audio.setEnabled(LF.storage.data.settings.sound);
          document.getElementById('soundBtn').textContent=LF.storage.data.settings.sound?'♪':'×';
          document.getElementById('soundBtn').setAttribute('aria-pressed',String(LF.storage.data.settings.sound));
          this.refreshMeta();this.closeModal();this.toast('Nouvelle sauvegarde créée.');this.showMenu();
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
      this.persistDraft();
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
          card.setAttribute('aria-pressed',String(this.draft.parentA?.id===origin.id||this.draft.parentB?.id===origin.id));
          const build=document.createElement('span');build.className='origin-card-build';
          build.textContent='VIT '+origin.stats.vitality+' · PUI '+origin.stats.power+' · VIT. '+origin.stats.speed+' · '+(origin.ability?.name||'Pouvoir hybride');
          card.querySelector('.origin-card-info').appendChild(build);
          card.addEventListener('click',()=>selectOrigin(origin));grid.appendChild(card);LF.render.drawCard(card.querySelector('canvas'),origin,{ring:false,scale:.82});
        }
      };

      const update=()=>{
        renderSlot(slotA,this.draft.parentA,'A');renderSlot(slotB,this.draft.parentB,'B');
        next.disabled=!(this.draft.parentA&&this.draft.parentB);renderGrid();this.persistDraft();
      };
      node.querySelector('.roster-search').addEventListener('input',event=>{search=event.target.value.trim().toLowerCase();renderGrid();});
      node.querySelectorAll('.tab-button').forEach(button=>{
        button.setAttribute('aria-pressed',String(button.classList.contains('active')));
        button.addEventListener('click',()=>{node.querySelectorAll('.tab-button').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});button.classList.add('active');button.setAttribute('aria-pressed','true');filter=button.dataset.filter;renderGrid();});
      });
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
        try{const child=LF.fusion.decodeChild(card.querySelector('textarea').value);if(!LF.storage.addOrUpdateHeir(child))throw LF.storage.lastError||new Error('Import impossible.');this.closeModal();this.toast(`${child.name} a rejoint la dynastie.`);this.showFusion();}
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
            button.setAttribute('aria-pressed',String(this.draft.education[group.id]===option.id));
            button.innerHTML=`<strong>${option.icon?`${option.icon} `:''}${U.escapeHtml(option.name)}</strong><p>${U.escapeHtml(option.desc)}</p><span class="education-effect">${U.escapeHtml(option.effect)}</span>`;
            button.addEventListener('click',()=>{this.draft.education[group.id]=option.id;LF.audio.play('select');render();});options.appendChild(button);
          }
          columns.appendChild(section);
        }
        node.querySelector('.education-forge').disabled=!this.draft.education.mentor||!this.draft.education.discipline||!this.draft.education.event;
        this.persistDraft();
      };
      const seedInput=node.querySelector('#seedInput');seedInput.value=this.draft.seed;
      seedInput.addEventListener('input',()=>{this.draft.seed=seedInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,12);seedInput.value=this.draft.seed;this.persistDraft();});
      node.querySelector('.seed-random').addEventListener('click',()=>{this.draft.seed=this.randomSeed();seedInput.value=this.draft.seed;LF.audio.play('select');this.persistDraft();});
      node.querySelector('.education-back').addEventListener('click',()=>this.showFusion());
      node.querySelector('.education-forge').addEventListener('click',()=>{
        try{
          this.draft.child=LF.fusion.generateChild(this.draft.parentA,this.draft.parentB,this.draft.education,this.draft.seed);
          this.persistDraft();LF.audio.play('forge');
          document.body.classList.add('forging');setTimeout(()=>{document.body.classList.remove('forging');this.showReveal();},620);
        }catch(error){this.toast(error.message,'error');}
      });
      render();
    }

    showReveal() {
      const child=this.draft.child;if(!child)return this.showEducation();
      this.persistDraft();
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

    showGame(resumeState=null) {
      const child=this.draft.child;if(!child)return this.showMenu();
      this.persistDraft();
      const node=this.mount(this.template('gameTemplate'),'game',`MISSION ACTIVE — ${child.name.toUpperCase()}`);
      this.resultHandled=false;
      const runToken=U.randomId('run');this.activeRunToken=runToken;
      const canvas=node.querySelector('#gameCanvas');
      const game=new LF.ArenaGame(canvas,child,node,{
        onUpgrade:(instance,payload)=>this.showUpgradeModal(instance,payload),
        onPause:instance=>this.showPauseModal(instance),
        onEnd:result=>this.handleRunEnd(result,child,runToken),
        onCheckpoint:state=>{if(this.draft.mode==='campaign'&&this.activeRunToken===runToken)LF.storage.setActiveRun(state);},
        resumeState,
        quality:LF.storage.data.settings.quality||'auto'
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
      this.showModal(card,{locked:true});
    }

    showPauseModal(game) {
      if(game.paused&&game.pauseReason==='upgrade')return;
      game.setPaused(true,'manual');
      const card=document.createElement('div');card.className='modal-card';
      card.innerHTML=`<p class="eyebrow">MISSION SUSPENDUE</p><h3>Pause</h3><p>ZQSD/WASD pour bouger · clic pour tirer · 1 et 2 pour les héritages · R pour la fusion · Espace pour l’esquive.</p><div class="modal-actions"><button class="ghost-button abandon">Abandonner</button><button class="primary-button resume">Reprendre</button></div>`;
      card.querySelector('.resume').addEventListener('click',()=>{this.closeModal();game.setPaused(false);});
      card.querySelector('.abandon').addEventListener('click',()=>this.confirm('Abandonner la mission ?', 'L’héritier sera archivé, mais cette tentative comptera comme une défaite.', 'Abandonner', ()=>{this.closeModal();game.end(false);}, true, ()=>this.showPauseModal(game)));
      this.showModal(card,{onEscape:()=>{this.closeModal();game.setPaused(false);}});
    }

    handleRunEnd(result,child,runToken) {
      if(this.resultHandled||runToken!==this.activeRunToken)return;this.resultHandled=true;
      const lab=this.draft.mode==='lab';
      const saved=lab?true:Boolean(LF.storage.completeRun(child,result));
      if(!saved)this.toast('La mission est terminée, mais l’archivage local a échoué. Exporte la sauvegarde avant de quitter.','error',5200);
      this.refreshMeta();
      this.showResults(result,child,{lab,saved});
    }

    showResults(result,childOverride=null,options={}) {
      const child=childOverride||this.draft.child;
      const lab=Boolean(options.lab),saved=options.saved!==false;
      const status=lab?'SIMULATION DU LABORATOIRE — TERMINÉE':saved?(result.victory?'LIGNÉE VICTORIEUSE — ARCHIVÉE':'MISSION TERMINÉE — HÉRITIER ARCHIVÉ'):'MISSION TERMINÉE — ARCHIVAGE EN ÉCHEC';
      const node=this.mount(this.template('resultsTemplate'),'results',status);
      node.querySelector('.result-kicker').textContent=result.victory?'LE PROGÉNITEUR EST TOMBÉ':'LA FRACTURE A REJETÉ L’HÉRITIER';
      node.querySelector('.result-title').textContent=result.victory?'Dynastie validée':'Lignée interrompue';
      node.querySelector('.result-copy').textContent=result.victory?`${child.name} n’est plus une anomalie expérimentale : sa lignée est désormais capable de survivre à tous les royaumes connus.`:`${child.name} rejoint malgré tout les archives du Berceau. Ses gènes restent disponibles pour une nouvelle génération mieux préparée.`;
      const stats=[['SCORE',U.formatNumber(result.score)],['ÉLIMINATIONS',U.formatNumber(result.kills)],['NIVEAU',result.level],['TEMPS',U.formatTime(result.time)],['COMBO MAX',result.maxCombo],['PRÉCISION',`${result.accuracy}%`]];
      node.querySelector('.result-stats').innerHTML=stats.map(([label,value])=>`<div class="result-stat"><small>${label}</small><strong>${value}</strong></div>`).join('');
      node.querySelector('.result-rewards').innerHTML=`<strong>◆ +${U.formatNumber(result.essence)} ESSENCE DYNASTIQUE</strong><br>${result.victory?'Statut Légende obtenu. Cet héritier transmettra une lignée prestigieuse.':'L’héritier est sauvegardé et peut immédiatement devenir parent.'}`;
      if(lab){
        node.querySelector('.result-kicker').textContent='SIMULATION SANS CONSÉQUENCE';
        node.querySelector('.result-title').textContent=result.victory?'Prototype validé':'Données de combat collectées';
        node.querySelector('.result-copy').textContent=child.name+' a été testé sans modifier la dynastie ni la mission de campagne sauvegardée.';
        node.querySelector('.result-rewards').textContent='Laboratoire libre : aucun archivage et aucune Essence attribuée.';
      }else if(!saved){
        node.querySelector('.result-copy').textContent='Le combat est terminé, mais le navigateur a refusé l’écriture. Le point de reprise est conservé pour éviter toute perte.';
        node.querySelector('.result-rewards').textContent='Archivage non confirmé : libère de l’espace ou exporte la sauvegarde avant de réessayer.';
      }
      const actions=node.querySelector('.result-actions');
      actions.innerHTML=`<button class="primary-button next-gen">Nouvelle génération <span>→</span></button><button class="secondary-button replay">Rejouer cet héritier</button><button class="ghost-button tree">Voir la dynastie</button><button class="ghost-button menu">Menu principal</button>`;
      const persisted=LF.storage.data.dynasty.find(entry=>entry.id===child.id)||child;
      if(lab)actions.querySelector('.next-gen').textContent='Nouvelle expérience';
      actions.querySelector('.next-gen').addEventListener('click',()=>lab?this.beginFusion('lab'):this.beginFusion('campaign',LF.fusion.childAsOrigin(persisted)));
      actions.querySelector('.replay').addEventListener('click',()=>{this.draft.child=U.deepClone(persisted);if(!lab)this.persistDraft();this.showGame();});
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

    showOnboarding() {
      if(this.currentScreen!=='menu'||!LF.storage.data.progression||LF.storage.data.progression.tutorialSeen)return;
      const card=document.createElement('div');card.className='modal-card';card.tabIndex=-1;
      card.innerHTML='<p class="eyebrow">BIENVENUE AU BERCEAU ZÉRO</p><h3>Ta première lignée en trois gestes</h3><p>Forge un héritier, apprends son build puis sécurise chaque vague. La mission pourra reprendre au dernier point sûr.</p><div class="onboarding-steps"><div class="onboarding-step"><strong>1 · Fusionne</strong><span>Choisis deux origines. Leurs statistiques, éléments et pouvoirs se transmettent.</span></div><div class="onboarding-step"><strong>2 · Façonne</strong><span>Mentor, discipline et événement rendent chaque enfant réellement différent.</span></div><div class="onboarding-step"><strong>3 · Survis</strong><span>Déplace-toi, tire, esquive et combine 1, 2 puis R contre douze vagues.</span></div></div><div class="modal-actions"><button class="ghost-button guide">Guide complet</button><button class="primary-button start">Forger ma première lignée</button></div>';
      const markSeen=()=>{LF.storage.data.progression.tutorialSeen=true;LF.storage.save();};
      card.querySelector('.guide').addEventListener('click',()=>{markSeen();this.closeModal();this.showHelp();});
      card.querySelector('.start').addEventListener('click',()=>{markSeen();this.closeModal();this.beginFusion('campaign');});
      this.showModal(card);
    }

    showSettings() {
      const card=document.createElement('div');card.className='modal-card';card.tabIndex=-1;
      card.innerHTML='<p class="eyebrow">RÉGLAGES</p><h3>Confort et accessibilité</h3><p>Ces préférences sont enregistrées avec la dynastie.</p><div class="settings-grid"><div class="setting-row"><span><strong>Son</strong><small>Musique et effets synthétisés</small></span><button class="ghost-button toggle-button sound-setting"></button></div><div class="setting-row"><span><strong>Mouvements réduits</strong><small>Supprime les animations non essentielles</small></span><button class="ghost-button toggle-button motion-setting"></button></div><div class="setting-row"><span><strong>Contraste renforcé</strong><small>Éclaircit les textes et les contours</small></span><button class="ghost-button toggle-button contrast-setting"></button></div><label class="setting-row"><span><strong>Qualité des effets</strong><small>Adapte les particules aux performances de l’appareil</small></span><select class="quality-setting"><option value="auto">Automatique</option><option value="high">Élevée</option><option value="low">Économie</option></select></label></div><div class="modal-actions"><button class="primary-button close-settings">Terminé</button></div>';
      const bindToggle=(selector,key,label)=>{
        const button=card.querySelector(selector);
        const render=()=>{const value=Boolean(LF.storage.data.settings[key]);button.textContent=value?label+' : activé':label+' : désactivé';button.setAttribute('aria-pressed',String(value));};
        button.addEventListener('click',()=>{LF.storage.data.settings[key]=!LF.storage.data.settings[key];const saved=LF.storage.save();if(!saved)this.toast('Le réglage n’a pas pu être enregistré.','error');if(key==='sound')LF.audio.setEnabled(LF.storage.data.settings.sound);this.applySettings();render();});
        render();
      };
      bindToggle('.sound-setting','sound','Son');
      bindToggle('.motion-setting','reducedMotion','Mouvements réduits');
      bindToggle('.contrast-setting','highContrast','Contraste');
      const quality=card.querySelector('.quality-setting');quality.value=LF.storage.data.settings.quality||'auto';
      quality.addEventListener('change',()=>{LF.storage.data.settings.quality=quality.value;if(!LF.storage.save()){quality.value=LF.storage.data.settings.quality||'auto';this.toast('Le réglage n’a pas pu être enregistré.','error');}});
      card.querySelector('.close-settings').addEventListener('click',()=>{const sound=Boolean(LF.storage.data.settings.sound);document.getElementById('soundBtn').textContent=sound?'♪':'×';document.getElementById('soundBtn').setAttribute('aria-pressed',String(sound));this.closeModal();});
      this.showModal(card);
    }

    showLegacy() {
      const node=this.mount(this.template('legacyTemplate'),'legacy','HÉRITAGE DU BERCEAU — STABILISATION');
      const grid=node.querySelector('.legacy-grid');
      const render=()=>{
        const legacy=LF.storage.data.progression.legacy;
        node.querySelector('.legacy-balance').innerHTML='<small>ESSENCE DISPONIBLE</small><strong>◆ '+U.formatNumber(LF.storage.data.essence)+'</strong>';
        grid.innerHTML='';
        for(const upgrade of LF.LEGACY_UPGRADES){
          const rank=Number(legacy[upgrade.id])||0;
          const cost=upgrade.baseCost*(rank+1);
          const card=document.createElement('article');card.className='legacy-card';
          const ranks=Array.from({length:upgrade.maxRank},(_,index)=>'<span class="'+(index<rank?'active':'')+'"></span>').join('');
          card.innerHTML='<div class="legacy-icon">'+U.escapeHtml(upgrade.icon)+'</div><h3>'+U.escapeHtml(upgrade.name)+'</h3><p>'+U.escapeHtml(upgrade.desc)+'</p><div class="legacy-ranks" aria-label="Rang '+rank+' sur '+upgrade.maxRank+'">'+ranks+'</div><button class="secondary-button" '+(rank>=upgrade.maxRank?'disabled':'')+'>'+(rank>=upgrade.maxRank?'Rang maximum':'Investir ◆ '+U.formatNumber(cost))+'</button>';
          card.querySelector('button').addEventListener('click',()=>{
            if(LF.storage.purchaseLegacy(upgrade.id,cost,upgrade.maxRank)){LF.audio.play('level');this.refreshMeta();render();this.toast(upgrade.name+' atteint le rang '+(rank+1)+'.');}
            else this.toast('Essence insuffisante ou rang maximum atteint.','error');
          });
          grid.appendChild(card);
        }
      };
      render();
    }

    showHelp() {
      if(LF.storage.data.progression&&!LF.storage.data.progression.tutorialSeen){LF.storage.data.progression.tutorialSeen=true;LF.storage.save();}
      const node=this.mount(this.template('helpTemplate'),'help','MANUEL DU BERCEAU — OUVERT');
      node.querySelector('.help-play').addEventListener('click',()=>this.beginFusion('campaign'));
    }
  }

  window.addEventListener('DOMContentLoaded',()=>{
    window.legacyForgeApp=new LegacyForgeApp();
  });
})();
