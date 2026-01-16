
import React, { useState, useEffect, useRef } from 'react';
import { AppView, Leader, Report, Settings, Discipleship } from './types';
import { Icons, WEEKS, MONTHS } from './constants';
import { supabase } from './supabaseClient';

const COLOR_PALETTES = [
  { id: 'indigo', primary: '#4F46E5', secondary: '#818CF8', tailwind: 'indigo' },
  { id: 'emerald', primary: '#10B981', secondary: '#34D399', tailwind: 'emerald' },
  { id: 'rose', primary: '#E11D48', secondary: '#FB7185', tailwind: 'rose' },
  { id: 'amber', primary: '#D97706', secondary: '#FBBF24', tailwind: 'amber' },
  { id: 'violet', primary: '#7C3AED', secondary: '#A78BFA', tailwind: 'violet' },
];

// Helper de formatação de nome (Capitalize)
const formatName = (name: string) => {
  return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const App: React.FC = () => {
  // --- Estados de Navegação e Autenticação ---
  const [view, setView] = useState<AppView>(AppView.SELECTION);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<'pastor' | 'discipulador' | null>(null); // Role do usuário logado ou intencionado

  // --- Estados de Cadastro/Login ---
  const [regForm, setRegForm] = useState({ name: '', discipleship: '', email: '', password: '', photo: '', pin: '' });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // --- Estados de Dados do Supabase ---
  const [publicDiscipleships, setPublicDiscipleships] = useState<Discipleship[]>([]);
  const [activeDiscipleship, setActiveDiscipleship] = useState<Discipleship | null>(null);
  const [pastorProfile, setPastorProfile] = useState<{ name: string, photo: string, id: string } | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<any>(WEEKS[0]);
  const [isWeekSelectorOpen, setIsWeekSelectorOpen] = useState(false);

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [reports, setReports] = useState<Report[]>([]); // Reports do discipulado ativo
  const [currentLeader, setCurrentLeader] = useState<Leader | null>(null);

  // --- Estados do Pastor ---
  const [myDisciples, setMyDisciples] = useState<Discipleship[]>([]); // Apenas cadastro
  const [pastorSummary, setPastorSummary] = useState<any[]>([]); // Dados da view (numeros)
  const [allReports, setAllReports] = useState<Report[]>([]); // Relatórios consolidados da rede
  const [allNetworkLeaders, setAllNetworkLeaders] = useState<any[]>([]);
  const [isAllLeadersModalOpen, setIsAllLeadersModalOpen] = useState(false);

  // --- Estados Ranking & Detalhes ---
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [rankingMode, setRankingMode] = useState<'weekly' | 'monthly'>('weekly');
  const [rankingTab, setRankingTab] = useState<'cell' | 'worship'>('cell');
  const [selectedDiscipleDetail, setSelectedDiscipleDetail] = useState<Discipleship | null>(null);
  const [detailLeaders, setDetailLeaders] = useState<any[]>([]);

  // --- Estados de Metas ---
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [currentGoalLeader, setCurrentGoalLeader] = useState<Leader | null>(null);
  const [goalForm, setGoalForm] = useState({ cell: '', worship: '' });
  const [isPastorExportModalOpen, setIsPastorExportModalOpen] = useState(false);
  const [pastorExportTab, setPastorExportTab] = useState<'text' | 'image'>('text');

  // Modais e UI
  const [isLeadersModalOpen, setIsLeadersModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isReportTextModalOpen, setIsReportTextModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const [isLinkDiscipleModalOpen, setIsLinkDiscipleModalOpen] = useState(false); // Modal vincular discipulo
  const [availableDiscipleships, setAvailableDiscipleships] = useState<Discipleship[]>([]); // Lista para vincular

  // Modal de Exclusão de Relatório
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentDeleteLeader, setCurrentDeleteLeader] = useState<Leader | null>(null);

  const [pinModalOpen, setPinModalOpen] = useState(false); // Modal de senha do lider
  const [pinInput, setPinInput] = useState(['', '', '', '']); // 4 digitos
  const [pendingDiscipleship, setPendingDiscipleship] = useState<Discipleship | null>(null); // Discipulado aguardando senha

  const [sendingStatus, setSendingStatus] = useState<{ [key: string]: boolean }>({});
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [newLeaderName, setNewLeaderName] = useState('');

  const [settings, setSettings] = useState<Settings>({
    userName: 'Discipulador',
    discipleshipName: 'Meu Discipulado',
    themeColor: 'indigo'
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePalette = COLOR_PALETTES.find(p => p.id === (activeDiscipleship ? (activeDiscipleship as any).theme_color || 'indigo' : settings.themeColor)) || COLOR_PALETTES[0];

  // Helper de formatação de nome (Capitalize)
  const formatName = (name: string) => {
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const [notifPermission, setNotifPermission] = useState<string>('default');

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  // --- Efeitos ---
  useEffect(() => {
    document.documentElement.classList.add('dark');

    // Inicializar OneSignal
    const OneSignal = (window as any).OneSignal || [];
    OneSignal.push(() => {
      OneSignal.init({
        appId: "cebd1701-9209-4647-821f-b3dcf4e07565",
        allowLocalhostAsSecureOrigin: true,
      });

      const checkPermission = () => {
        // OneSignal.Notifications.permission é booleano no SDK v16
        // Notification.permission é a API nativa do browser (granted, denied, default)
        const hasPermission = OneSignal.Notifications?.permission === true || (window.Notification && Notification.permission === 'granted');
        console.log("Notif Permission Check:", { OneSignal: OneSignal.Notifications?.permission, Native: window.Notification?.permission });
        setNotifPermission(hasPermission ? 'granted' : 'default');
      };

      checkPermission();

      // Sincronizar token se já tiver permissão
      setTimeout(async () => {
        const pushId = OneSignal.User.PushSubscription.id;
        if (pushId) {
          console.log("Auto-syncing token:", pushId);
          // O targetId aqui é difícil pegar sem a sessão, mas se tivermos sessão, podemos tentar
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.from('profiles').update({ push_token: pushId }).eq('id', session.user.id);
          }
        }
      }, 5000);

      // Adicionar listener para mudanças de permissão
      OneSignal.Notifications.addEventListener("permissionChange", (permission: boolean) => {
        console.log("Permission changed:", permission);
        setNotifPermission(permission ? 'granted' : 'default');
      });
    });

    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        if (view !== AppView.SELECTION && view !== AppView.CHOOSE_DISCIPLESHIP && view !== AppView.LEADER_LIST && view !== AppView.LEADER_DASHBOARD && view !== AppView.RANKING) {
          setView(AppView.SELECTION);
          setActiveDiscipleship(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const requestNotificationPermission = async (targetId: string, type: 'discipulador' | 'leader') => {
    try {
      const OneSignal = (window as any).OneSignal;
      if (!OneSignal) {
        alert("DEBUG: Biblioteca OneSignal não carregada. Tente recarregar a página.");
        return;
      }

      console.log("Solicitando permissão...");
      await OneSignal.Notifications.requestPermission();

      // Atualizar estado da UI imediatamente se a permissão foi concedida
      if (OneSignal.Notifications.permission) {
        setNotifPermission('granted');
      }

      // Tentar obter o push ID (pode demorar alguns segundos após o aceite)
      let pushId = OneSignal.User.PushSubscription.id;

      // Se não tiver pushId na hora, esperar um pouco
      if (!pushId) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        pushId = OneSignal.User.PushSubscription.id;
      }

      if (pushId) {
        if (type === 'discipulador') {
          await supabase.from('profiles').update({ push_token: pushId }).eq('id', targetId);
          if (activeDiscipleship && activeDiscipleship.id === targetId) {
            setActiveDiscipleship({ ...activeDiscipleship, push_token: pushId });
          }
        } else {
          await supabase.from('leaders').update({ push_token: pushId }).eq('id', targetId);
          if (currentLeader && currentLeader.id === targetId) {
            setCurrentLeader({ ...currentLeader, push_token: pushId });
          }
          setLeaders(prev => prev.map(l => l.id === targetId ? { ...l, push_token: pushId } : l));
        }
        alert("Notificações ativadas com sucesso! No iPhone, verifique se você adicionou o app à sua Tela de Início.");
      } else {
        // PERMISSÃO NÃO CONCEDIDA NA HORA
        console.warn("Permissão não concedida ou Push ID não gerado.");

        if (OneSignal.Notifications.permission) {
          // Caso raríssimo onde permission=true mas pushId=null
          alert("Permissão de sistema concedida, mas não foi possível gerar o Token. Tente recarregar a página.");
        } else {
          // Permission = false (Negado ou Fechado)
          if (Notification.permission === 'denied') {
            alert("As notificações estão BLOQUEADAS no seu navegador. Acesse as Configurações do Site (ícone de cadeado na barra de endereço) e vá em 'Permissões' > 'Notificações' para permitir.");
          } else {
            alert("Para ativar o recurso, você precisa clicar em 'Permitir' quando o navegador perguntar.");
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao ativar notificações: " + (err.message || err));
    }
  };

  const syncPushToken = async (userId: string) => {
    try {
      const OneSignal = (window as any).OneSignal;
      if (!OneSignal) return;
      const pushId = OneSignal.User.PushSubscription.id;
      if (pushId) {
        await supabase.from('profiles').update({ push_token: pushId }).eq('id', userId);
        if (activeDiscipleship && activeDiscipleship.id === userId) {
          setActiveDiscipleship({ ...activeDiscipleship, push_token: pushId });
        }
      }
    } catch (err) { }
  };

  useEffect(() => {
    if (activeDiscipleship && userRole !== 'pastor') { // Se for pastor, carregamos de forma diferente
      fetchLeadersAndReports(activeDiscipleship.id);
      setSettings({
        userName: activeDiscipleship.discipuladorName || activeDiscipleship.name,
        discipleshipName: activeDiscipleship.name,
        themeColor: (activeDiscipleship as any).theme_color || 'indigo'
      });
    } else if (userRole === 'pastor' && session) {
      // Se for pastor, recarregar dados quando muda a semana
      fetchPastorData(session.user.id);
    }
  }, [activeDiscipleship, selectedWeek, userRole]);

  useEffect(() => {
    if (view === AppView.RANKING) {
      fetchRanking();
    }
  }, [view, selectedWeek, rankingMode]);

  // --- Data Fetching ---
  const fetchMyDisciples = async (pastorId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'discipulador'); // Simples, depois filtra por rede se tiver
    // Na v1, pastor vê todos discipuladores. Na v2, filtrar por rede.
    if (data) setMyDisciples(data.map((d: any) => ({
      id: d.id, name: d.name, discipleshipName: d.discipleship_name,
      photo: d.avatar_url, themeColor: d.theme_color,
      discipuladorName: d.name, discipuladorPhoto: d.avatar_url // Map user fields
    })));
  };

  const fetchUserProfile = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      const role = data.role as 'pastor' | 'discipulador';
      setUserRole(role);

      // Sincronizar token de notificação
      syncPushToken(userId);

      if (role === 'pastor') {
        setPastorProfile({ name: data.name, photo: data.avatar_url, id: data.id });
        fetchPastorData(userId);
        setView(AppView.PASTOR_DASHBOARD);
      } else {
        const OneSignal = (window as any).OneSignal;
        const currentPushId = OneSignal?.User?.PushSubscription?.id;

        const discipulado: Discipleship = {
          id: data.id,
          name: data.discipleship_name,
          discipuladorName: data.name,
          discipuladorPhoto: data.avatar_url,
          email: data.email,
          theme_color: data.theme_color,
          role: data.role,
          access_pin: data.access_pin,
          pastor_id: data.pastor_id,
          push_token: data.push_token || currentPushId
        };
        setActiveDiscipleship(discipulado);
        setView(AppView.DISCIPLE_DASHBOARD);
      }
    }
    setLoading(false);
  };

  const fetchPastorData = async (pastorId: string) => {
    // 1. Buscar discipulos vinculados
    const { data: disciples } = await supabase
      .from('profiles')
      .select('*')
      .eq('pastor_id', pastorId);

    const formattedDisciples: Discipleship[] = (disciples || []).map((d: any) => ({
      id: d.id, name: d.discipleship_name, discipuladorName: d.name, discipuladorPhoto: d.avatar_url,
      email: d.email, theme_color: d.theme_color, role: d.role, access_pin: d.access_pin, pastor_id: d.pastor_id
    }));
    setMyDisciples(formattedDisciples);

    // 2. Buscar Resumo Macro da Semana (View)
    const { data: summary } = await supabase
      .from('pastor_network_summary')
      .select('*')
      .eq('pastor_id', pastorId)
      .eq('week_id', selectedWeek.id);

    setPastorSummary(summary || []);
  };

  const fetchRanking = async () => {
    let weekIds: string[] = [];
    if (rankingMode === 'weekly') {
      weekIds = [selectedWeek.id];
    } else {
      // Mensal: Pega todas as semanas do mês da selectedWeek
      const monthName = selectedWeek.month;
      const monthObj = MONTHS.find(m => m.name === monthName);
      if (monthObj) weekIds = monthObj.weeks.map(w => w.id);
      else weekIds = [selectedWeek.id];
    }

    const { data, error } = await supabase.rpc('get_global_ranking', { target_week_ids: weekIds });
    if (data) setRankingData(data);
  };

  const fetchDiscipleDetails = async (disciple: Discipleship) => {
    setSelectedDiscipleDetail(disciple);
    const { data } = await supabase.rpc('get_discipleship_details', { target_user_id: disciple.id, target_week_id: selectedWeek.id });
    setDetailLeaders(data || []);
  };

  const fetchPublicDiscipleships = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'discipulador'); // Apenas discipuladores aparecem para líderes
    if (data) {
      const formatted = data.map((d: any) => ({
        id: d.id, name: d.discipleship_name, discipuladorName: d.name, discipuladorPhoto: d.avatar_url,
        email: d.email, theme_color: d.theme_color, role: d.role, access_pin: d.access_pin,
        push_token: d.push_token
      }));
      setPublicDiscipleships(formatted);
    }
    setLoading(false);
  };

  const fetchLeadersAndReports = async (userId: string) => {
    const { data: leadersData } = await supabase.from('leaders').select('*').eq('user_id', userId);
    if (leadersData) {
      setLeaders(leadersData.map((l: any) => ({
        id: l.id,
        name: l.name,
        discipleshipId: l.user_id,
        push_token: l.push_token,
        goal_cell: l.goal_cell,
        goal_worship: l.goal_worship
      })));
    }

    // 2. Buscar Relatórios
    if (leadersData && leadersData.length > 0) {
      const leaderIds = leadersData.map((l: any) => l.id);
      const { data: reportsData } = await supabase.from('reports').select('*').in('leader_id', leaderIds).eq('week_id', selectedWeek.id);

      if (reportsData) {
        setReports(reportsData.map((r: any) => ({
          leaderId: r.leader_id, weekId: r.week_id, cellCount: r.cell_count, worshipCount: r.worship_count, cellSent: r.cell_sent, worshipSent: r.worship_sent,
          goalCell: r.goal_cell, goalWorship: r.goal_worship
        })));
      } else {
        setReports([]);
      }
    } else {
      setReports([]);
    }
  };

  const fetchDisciplesForLinking = async () => {
    // Busca discipuladores que ainda não tem pastor (opcional: ou todos para permitir troca)
    // Vamos buscar todos que são discipuladores.
    const { data } = await supabase.from('profiles').select('*').eq('role', 'discipulador');
    if (data) {
      setAvailableDiscipleships(data.map((d: any) => ({
        id: d.id, name: d.discipleship_name, discipuladorName: d.name, discipuladorPhoto: d.avatar_url,
        email: d.email, theme_color: d.theme_color, role: d.role, access_pin: d.access_pin, pastor_id: d.pastor_id
      })).filter(d => d.pastor_id !== session.user.id)); // Filtra os que já são meus
    }
  };

  const linkDisciple = async (discipleId: string) => {
    // Chama a RPC create_link
    const { error } = await supabase.rpc('link_discipleship', { target_id: discipleId });
    if (error) {
      alert("Erro ao vincular: " + error.message);
    } else {
      alert("Discipulador vinculado com sucesso!");
      fetchPastorData(session.user.id); // atualiza lista
      setIsLinkDiscipleModalOpen(false);
    }
  };

  // --- Lógica de Auth ---
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => { setRegForm({ ...regForm, photo: reader.result as string }); };
      reader.readAsDataURL(file);
    }
  };



  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerPhotoUpload = () => {
    fileInputRef.current?.click();
  }

  const handleUpdateProfilePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !session) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}_${Date.now()}.${fileExt}`;

    setLoading(true);
    try {
      await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      // Update URL with timestamp or unique name to force refresh
      const finalUrl = publicUrl;

      const { error } = await supabase.from('profiles').update({ avatar_url: finalUrl }).eq('id', session.user.id);

      if (error) throw error;

      // Update local state
      if (userRole === 'discipulador' && activeDiscipleship) {
        setActiveDiscipleship({ ...activeDiscipleship, discipuladorPhoto: finalUrl });
      } else if (userRole === 'pastor' && pastorProfile) {
        setPastorProfile({ ...pastorProfile, photo: finalUrl });
      }

    } catch (error: any) {
      console.error('Error uploading photo:', error);
      alert('Erro ao atualizar foto: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: regForm.email, password: regForm.password,
    });

    if (authError) { alert("Erro: " + authError.message); setLoading(false); return; }

    if (authData.user) {
      let finalAvatarUrl = regForm.photo;
      if (photoFile) {
        try {
          const fileExt = photoFile.name.split('.').pop();
          const fileName = `${authData.user.id}.${fileExt}`;
          // Upload Storage
          await supabase.storage.from('avatars').upload(fileName, photoFile, { upsert: true });
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
          finalAvatarUrl = publicUrl;
        } catch (err) { console.error(err); }
      }

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: authData.user.id,
        email: regForm.email,
        name: formatName(regForm.name),
        discipleship_name: userRole === 'pastor' ? 'Rede Pastoral' : formatName(regForm.discipleship), // Se for pastor, nome da rede
        avatar_url: finalAvatarUrl,
        theme_color: 'indigo',
        role: userRole,
        access_pin: userRole === 'discipulador' ? regForm.pin : null // Só salva pin se for discipulador
      }]);

      if (profileError) alert("Erro perfil: " + profileError.message);
      else alert("Conta criada!");
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email, password: loginForm.password,
    });
    if (error) alert("Erro: " + error.message);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null); setUserRole(null); setView(AppView.SELECTION); setActiveDiscipleship(null);
  };

  // --- Lógica PIN ---
  const handlePinSubmit = () => {
    const enteredPin = pinInput.join('');
    if (!pendingDiscipleship) return;

    // Verifica o PIN
    if (pendingDiscipleship.access_pin === enteredPin) {
      setActiveDiscipleship(pendingDiscipleship);
      setView(AppView.LEADER_LIST);
      setPinModalOpen(false);
      setPinInput(['', '', '', '']);
    } else {
      alert("Senha incorreta!");
      setPinInput(['', '', '', '']);
    }
  };

  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newPin = [...pinInput];
    newPin[index] = value;
    setPinInput(newPin);
    // Auto focus next
    if (value !== '' && index < 3) {
      document.getElementById(`pin-${index + 1}`)?.focus();
    }
  };

  // --- Lógica Dados ---
  const addLeader = async () => {
    if (!newLeaderName.trim() || !session) return;
    const formattedName = formatName(newLeaderName);

    // Check duplication locally
    if (leaders.some(l => l.name.toLowerCase() === formattedName.toLowerCase())) {
      alert("Já existe um líder com este nome.");
      return;
    }

    const { data } = await supabase.from('leaders').insert([{ name: formattedName, user_id: session.user.id }]).select().single();
    if (data) {
      setLeaders([...leaders, { id: data.id, name: data.name, discipleshipId: data.user_id }]);
      setNewLeaderName('');
    }
  };

  const removeLeader = async (id: string) => {
    const { error } = await supabase.from('leaders').delete().eq('id', id);
    if (!error) {
      setLeaders(leaders.filter(l => l.id !== id));
      setReports(reports.filter(r => r.leaderId !== id));
    }
  };

  const openGoalModal = (leader: Leader) => {
    setCurrentGoalLeader(leader);
    const r = reports.find(rep => rep.leaderId === leader.id && rep.weekId === selectedWeek.id);
    // Usa a meta da semana se existir, senão a meta permanente do líder
    const cellGoal = r?.goalCell ?? leader.goal_cell ?? '';
    const worshipGoal = r?.goalWorship ?? leader.goal_worship ?? '';
    setGoalForm({ cell: cellGoal.toString(), worship: worshipGoal.toString() });
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = async () => {
    if (!currentGoalLeader) return;
    const cGoal = parseInt(goalForm.cell) || 0;
    const wGoal = parseInt(goalForm.worship) || 0;

    // 1. Atualizar meta permanente no líder
    const { error: updateError } = await supabase.from('leaders').update({ goal_cell: cGoal, goal_worship: wGoal }).eq('id', currentGoalLeader.id);
    if (updateError) {
      alert("Erro ao salvar meta no banco: " + updateError.message);
    }

    // 2. Atualizar ou Criar registro na semana atual
    const { data: existing } = await supabase.from('reports').select('*').eq('leader_id', currentGoalLeader.id).eq('week_id', selectedWeek.id).single();

    if (existing) {
      await supabase.from('reports').update({ goal_cell: cGoal, goal_worship: wGoal }).eq('id', existing.id);
    } else {
      await supabase.from('reports').insert([{
        leader_id: currentGoalLeader.id,
        week_id: selectedWeek.id,
        cell_count: 0, worship_count: 0,
        goal_cell: cGoal, goal_worship: wGoal,
        cell_sent: false, worship_sent: false
      }]);
    }

    // Update local state by refetching
    if (activeDiscipleship) fetchLeadersAndReports(activeDiscipleship.id);

    // Force update currentLeader if it is the one being edited
    if (currentLeader && currentLeader.id === currentGoalLeader.id) {
      setCurrentLeader({ ...currentLeader, goal_cell: cGoal, goal_worship: wGoal });
    }

    setIsGoalModalOpen(false);
  };

  const fetchAllNetworkLeaders = async () => {
    if (!session || userRole !== 'pastor') return;
    if (myDisciples.length === 0) await fetchMyDisciples(session.user.id);

    const discipleshipIds = myDisciples.map(d => d.id);
    if (discipleshipIds.length === 0) {
      setAllNetworkLeaders([]);
      return;
    }

    const { data: leadersData } = await supabase.from('leaders').select('id, name, user_id').in('user_id', discipleshipIds);
    if (leadersData) {
      const joined = leadersData.map(l => {
        const d = myDisciples.find(md => md.id === l.user_id);
        return {
          leader_id: l.id,
          leader_name: formatName(l.name),
          discipulador_name: d ? formatName(d.name) : 'Desconhecido',
          discipleship_name: d ? formatName(d.discipleshipName || '') : ''
        };
      });
      joined.sort((a, b) => a.discipulador_name.localeCompare(b.discipulador_name) || a.leader_name.localeCompare(b.leader_name));
      setAllNetworkLeaders(joined);
    }
  };

  const generatePastorNetworkText = () => {
    let t = `*RELATÓRIO DA REDE - ${selectedWeek.label}*\n\n`;
    const totalCell = pastorSummary.reduce((a, b: any) => a + (b.total_cell || 0), 0);
    const totalWorship = pastorSummary.reduce((a, b: any) => a + (b.total_worship || 0), 0);

    t += `📊 *TOTAIS GERAIS*\n🏠 Célula: ${totalCell}\n⛪ Culto: ${totalWorship}\n\n`;
    t += `----------------------------------\n\n`;

    myDisciples.forEach(d => {
      const s = pastorSummary.find(sum => sum.discipulador_id === d.id) || { total_cell: 0, total_worship: 0 };
      t += `👤 *${d.name}* (${d.discipuladorName})\n`;
      t += `   🏠 Célula: ${s.total_cell || 0}\n`;
      t += `   ⛪ Culto: ${s.total_worship || 0}\n\n`;
    });

    return t;
  };

  // Funções de relatório (handleSendReport, etc) - REUTILIZADAS DO ANTERIOR, Mantidas.
  const handleManualUpdateReport = (leaderId: string, weekId: string, type: 'cell' | 'worship', value: string) => {
    const numValue = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setReports(prev => {
      const existingIdx = prev.findIndex(r => r.leaderId === leaderId && r.weekId === weekId);
      if (existingIdx > -1) {
        const updated = [...prev]; updated[existingIdx] = { ...updated[existingIdx], [type === 'cell' ? 'cellCount' : 'worshipCount']: numValue }; return updated;
      } else { return [...prev, { leaderId, weekId, cellCount: type === 'cell' ? numValue : 0, worshipCount: type === 'worship' ? numValue : 0 }]; }
    });
  };

  const handleSendReport = async (leaderId: string, weekId: string, type: 'cell' | 'worship') => {
    const key = `${leaderId}-${weekId}-${type}`; setSendingStatus(prev => ({ ...prev, [key]: true }));
    const report = reports.find(r => r.leaderId === leaderId && r.weekId === weekId);
    const cellCount = report?.cellCount || 0; const worshipCount = report?.worshipCount || 0;

    const { data: existing } = await supabase.from('reports').select('id').eq('leader_id', leaderId).eq('week_id', weekId).single();

    if (existing) {
      await supabase.from('reports').update(type === 'cell' ? { cell_count: cellCount, cell_sent: true } : { worship_count: worshipCount, worship_sent: true }).eq('id', existing.id);
    } else {
      await supabase.from('reports').insert([{ leader_id: leaderId, week_id: weekId, cell_count: cellCount, worship_count: worshipCount, cell_sent: type === 'cell', worship_sent: type === 'worship' }]);
    }
    setReports(prev => {
      const idx = prev.findIndex(r => r.leaderId === leaderId && r.weekId === weekId);
      const upd = [...prev]; if (idx > -1) upd[idx] = { ...upd[idx], [type === 'cell' ? 'cellSent' : 'worshipSent']: true };
      return upd;
    });
    setSendingStatus(prev => ({ ...prev, [key]: false }));
  };

  const clearReport = async (leaderId: string, weekId: string, type: 'cell' | 'worship') => {
    // Buscar se existe
    const { data: existing } = await supabase.from('reports').select('id, cell_count, worship_count').eq('leader_id', leaderId).eq('week_id', weekId).single();
    if (existing) {
      const updateData = type === 'cell'
        ? { cell_count: 0, cell_sent: false }
        : { worship_count: 0, worship_sent: false };

      await supabase.from('reports').update(updateData).eq('id', existing.id);

      setReports(prev => {
        const idx = prev.findIndex(r => r.leaderId === leaderId && r.weekId === weekId);
        if (idx > -1) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            [type === 'cell' ? 'cellCount' : 'worshipCount']: 0,
            [type === 'cell' ? 'cellSent' : 'worshipSent']: false
          };
          return updated;
        }
        return prev;
      });
    }
  };

  const totals = leaders.reduce((acc, l) => {
    const r = reports.find(rep => rep.leaderId === l.id && rep.weekId === selectedWeek.id);
    if (r) { acc.cell += (r.cellCount || 0); acc.worship += (r.worshipCount || 0); }
    return acc;
  }, { cell: 0, worship: 0 });


  const drawPastorNetworkImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !session) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 500;
    const height = 800;
    // Forçar dimensionamento
    canvas.width = width;
    canvas.height = height;

    const pColor = '#4F46E5'; // Indigo

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Header
    const headerHeight = 220;
    const headerGrad = ctx.createLinearGradient(0, 0, width, headerHeight);
    headerGrad.addColorStop(0, '#4338ca');
    headerGrad.addColorStop(1, '#312e81');
    ctx.fillStyle = headerGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(width, 0); ctx.lineTo(width, headerHeight - 40);
    ctx.quadraticCurveTo(width / 2, headerHeight + 20, 0, headerHeight - 40);
    ctx.closePath(); ctx.fill();

    ctx.textAlign = 'center'; ctx.fillStyle = 'white'; ctx.font = '900 32px sans-serif';
    ctx.fillText('RELATÓRIO DE REDE', width / 2, 65);
    ctx.font = '600 18px sans-serif'; ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText("VISÃO GERAL", width / 2, 100);

    // Date Badge
    const dateText = selectedWeek.label + ' (' + selectedWeek.range + ')';
    ctx.font = 'bold 12px sans-serif';
    const dateWidth = ctx.measureText(dateText).width + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.roundRect((width - dateWidth) / 2, 125, dateWidth, 28, 14); ctx.fill();
    ctx.fillStyle = 'white'; ctx.fillText(dateText, width / 2, 144);

    // Totais Rede
    const totalCell = pastorSummary.reduce((a, b: any) => a + (b.total_cell || 0), 0);
    const totalWorship = pastorSummary.reduce((a, b: any) => a + (b.total_worship || 0), 0);

    const drawCard = (x: number, y: number, w: number, h: number, label: string, val: string, color: string) => {
      ctx.fillStyle = '#1E293B'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x + 15, y + 25, 4, 60, 2); ctx.fill();
      ctx.textAlign = 'left'; ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#94A3B8';
      ctx.fillText(label, x + 30, y + 35);
      ctx.fillStyle = 'white'; ctx.font = '900 48px sans-serif'; ctx.fillText(val, x + 28, y + 85);
    };
    drawCard(30, 190, 210, 120, "REDE CÉLULAS", totalCell.toString(), pColor);
    drawCard(260, 190, 210, 120, "REDE CULTOS", totalWorship.toString(), '#10B981');

    // Lista de Discipulados
    ctx.textAlign = 'left'; ctx.fillStyle = 'white'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('POR DISCIPULADO', 35, 355);

    const startY = 385; const rowH = 60;

    myDisciples.forEach((d, idx) => {
      if (startY + idx * rowH > 750) return;

      const s = pastorSummary.find(sum => sum.discipulador_id === d.id) || { total_cell: 0, total_worship: 0 };
      const y = startY + idx * rowH;

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'; ctx.beginPath();
      ctx.moveTo(35, y + rowH - 10); ctx.lineTo(width - 35, y + rowH - 10); ctx.stroke();

      ctx.fillStyle = 'white'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(d.name, 40, y + 20);
      ctx.fillStyle = '#94A3B8'; ctx.font = '11px sans-serif';
      ctx.fillText(d.discipuladorName, 40, y + 38);

      // Badges
      const badge = (bx: number, bv: string, bc: string, bl: string) => {
        ctx.fillStyle = bc + '15'; ctx.beginPath(); ctx.roundRect(bx, y, 60, 40, 12); ctx.fill();
        ctx.fillStyle = bc; ctx.font = '900 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(bv, bx + 30, y + 20);
        ctx.fillStyle = bc; ctx.font = 'bold 8px sans-serif';
        ctx.fillText(bl, bx + 30, y + 32);
      };

      badge(width - 160, s.total_cell?.toString() || '0', '#6366F1', "CÉL");
      badge(width - 90, s.total_worship?.toString() || '0', '#10B981', "CULTO");
      ctx.textAlign = 'left';
    });
  };

  const drawReportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const pColor = activePalette.primary;
    const sColor = activePalette.secondary;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);
    const headerHeight = 220;
    const headerGrad = ctx.createLinearGradient(0, 0, width, headerHeight);
    headerGrad.addColorStop(0, pColor);
    headerGrad.addColorStop(1, sColor);
    ctx.fillStyle = headerGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(width, 0); ctx.lineTo(width, headerHeight - 40);
    ctx.quadraticCurveTo(width / 2, headerHeight + 20, 0, headerHeight - 40);
    ctx.closePath(); ctx.fill();

    ctx.textAlign = 'center'; ctx.fillStyle = 'white'; ctx.font = '900 32px sans-serif';
    ctx.fillText('RELATÓRIO SEMANAL', width / 2, 65);
    ctx.font = '600 18px sans-serif'; ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(settings.discipleshipName.toUpperCase(), width / 2, 100);

    const dateText = selectedWeek.range;
    ctx.font = 'bold 12px sans-serif';
    const dateWidth = ctx.measureText(dateText).width + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.roundRect((width - dateWidth) / 2, 125, dateWidth, 28, 14); ctx.fill();
    ctx.fillStyle = 'white'; ctx.fillText(dateText, width / 2, 144);

    const drawCard = (x: number, y: number, w: number, h: number, label: string, val: string, color: string) => {
      ctx.fillStyle = '#1E293B'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x + 15, y + 25, 4, 60, 2); ctx.fill();
      ctx.textAlign = 'left'; ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#94A3B8';
      ctx.fillText(label, x + 30, y + 35);
      ctx.fillStyle = 'white'; ctx.font = '900 48px sans-serif'; ctx.fillText(val, x + 28, y + 85);
    };
    drawCard(30, 190, 210, 120, "TOTAIS CÉLULAS", totals.cell.toString(), pColor);
    drawCard(260, 190, 210, 120, "TOTAIS CULTOS", totals.worship.toString(), '#10B981');

    ctx.textAlign = 'left'; ctx.fillStyle = 'white'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('RESULTADOS POR LÍDER', 35, 355);

    const startY = 385; const rowH = 50;
    const listLeaders = leaders.filter(l => reports.some(r => r.leaderId === l.id && r.weekId === selectedWeek.id));

    listLeaders.forEach((l, idx) => {
      if (startY + idx * rowH > 650) return;
      const r = reports.find(rep => rep.leaderId === l.id && rep.weekId === selectedWeek.id)!;
      const y = startY + idx * rowH;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'; ctx.beginPath();
      ctx.moveTo(35, y + rowH - 5); ctx.lineTo(width - 35, y + rowH - 5); ctx.stroke();
      ctx.fillStyle = 'white'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(l.name, 40, y + 20);
      const badge = (bx: number, bv: string, bc: string, bl: string) => {
        ctx.fillStyle = bc + '15'; ctx.beginPath(); ctx.roundRect(bx, y - 5, 75, 24, 8); ctx.fill();
        ctx.fillStyle = bc; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(bv, bx + 15, y + 11); ctx.fillStyle = '#64748B'; ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'left'; ctx.fillText(bl, bx + 30, y + 10);
      };
      badge(width - 180, r.cellCount.toString(), sColor, "CÉL");
      badge(width - 95, r.worshipCount.toString(), '#10B981', "CUL");
    });

    let topCell = { name: '---', val: 0 };
    let topWorship = { name: '---', val: 0 };
    leaders.forEach(l => {
      const r = reports.find(rep => rep.leaderId === l.id && rep.weekId === selectedWeek.id);
      if (r) {
        if (r.cellCount > topCell.val) topCell = { name: l.name, val: r.cellCount };
        if (r.worshipCount > topWorship.val) topWorship = { name: l.name, val: r.worshipCount };
      }
    });

    const mvpY = 680;
    const drawMVP = (x: number, title: string, name: string, val: string, color: string, icon: string) => {
      ctx.fillStyle = '#1E293B'; ctx.beginPath(); ctx.roundRect(x, mvpY, 210, 85, 20); ctx.fill();
      ctx.textAlign = 'left'; ctx.font = '900 8px sans-serif'; ctx.fillStyle = color;
      ctx.fillText(title, x + 15, mvpY + 25);
      ctx.fillStyle = 'white'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(name.length > 15 ? name.substring(0, 15) + '...' : name, x + 15, mvpY + 45);
      ctx.textAlign = 'right'; ctx.font = '900 24px sans-serif'; ctx.fillStyle = 'white';
      ctx.fillText(val, x + 195, mvpY + 55);
      ctx.font = '14px sans-serif'; ctx.fillText(icon, x + 195, mvpY + 25);
    };
    drawMVP(30, "DESTAQUE CÉLULA 🏠", topCell.name, topCell.val.toString(), sColor, "🔥");
    drawMVP(260, "DESTAQUE CULTO ⛪", topWorship.name, topWorship.val.toString(), '#10B981', "⭐");
    ctx.textAlign = 'center'; ctx.fillStyle = '#334155'; ctx.font = 'bold 9px sans-serif';
    ctx.fillText(`GERADO POR ${settings.userName.toUpperCase()} • CÉLULA REPORT`, width / 2, height - 20);
  };

  useEffect(() => { if (isImageModalOpen) setTimeout(drawReportImage, 150); }, [isImageModalOpen, settings.themeColor, reports]);

  const generateWhatsAppText = () => {
    const leaderLines = leaders.map(l => {
      const r = reports.find(rep => rep.leaderId === l.id && rep.weekId === selectedWeek.id);
      if (!r) return null;
      return `👤 *${l.name}*: Célula *${r.cellCount}* | Culto *${r.worshipCount}*`;
    }).filter(Boolean).join('\n');
    const weekLabel = selectedWeek.label || `Semana ${selectedWeek.n}`;
    const weekMonth = selectedWeek.month || '';
    return `📝 *Relatório Semanal de Discipulado*
━━━━━━━━━━━━━━━━━━
🤵 *Discipulador*: ${settings.userName}
🗓️ *Período*: ${weekLabel} (${selectedWeek.range}) - ${weekMonth}

📊 *Detalhamento por Líder*:
${leaderLines}

━━━━━━━━━━━━━━━━━━
✨ *Totais Consolidados*:
🏠 Total Célula: *${totals.cell}*
⛪ Total Culto: *${totals.worship}*`;
  };

  // Helpers UI
  const IconButton = ({ children, onClick, className = "" }: any) => (
    <button onClick={onClick} style={{ color: activePalette.primary }} className={`p-2 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}>{children}</button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1020] text-gray-800 dark:text-gray-100 transition-colors duration-300 antialiased font-sans">
      <div className="max-w-md mx-auto px-6 relative pb-10">

        {loading && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"><div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>}

        {/* TELA INICIAL REFEITA */}
        {view === AppView.SELECTION && !session && (
          <div className="flex flex-col items-center justify-center min-h-screen py-10 animate-in fade-in duration-500">
            <Icons.MainLogo />
            <h1 className="text-4xl font-black mb-2 tracking-tight">Célula Report</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-12 font-medium">Gestão estratégica da igreja.</p>

            <div className="w-full space-y-4">
              <button onClick={() => { setUserRole('pastor'); setView(AppView.LOGIN); }} className="w-full p-6 bg-indigo-600 text-white rounded-3xl font-black hover:shadow-xl hover:scale-105 transition-all text-xl shadow-indigo-500/30">
                SOU PASTOR
              </button>
              <button onClick={() => { setUserRole('discipulador'); setView(AppView.LOGIN); }} className="w-full p-6 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-3xl font-bold hover:shadow-lg transition-all text-lg">
                SOU DISCIPULADOR
              </button>
              <div className="py-4 flex items-center gap-4"><div className="h-px bg-gray-200 dark:bg-gray-800 flex-1"></div><span className="text-xs font-black opacity-30">ÁREA DO LÍDER</span><div className="h-px bg-gray-200 dark:bg-gray-800 flex-1"></div></div>
              <button onClick={() => { fetchPublicDiscipleships(); setView(AppView.CHOOSE_DISCIPLESHIP); }} className="w-full p-6 bg-emerald-500/10 text-emerald-600 rounded-3xl border border-emerald-500/20 font-black hover:bg-emerald-500 hover:text-white transition-all">
                SOU LÍDER
              </button>

              <button onClick={() => setView(AppView.RANKING)} className="w-full p-4 mt-4 bg-transparent border-2 border-gray-200 dark:border-gray-800 rounded-3xl font-bold uppercase tracking-widest text-xs hover:border-indigo-500 hover:text-indigo-500 transition-all">
                🏆 Ranking Geral
              </button>
            </div>

            <p className="mt-8 text-xs opacity-40">Versão 2.0 • Com Integração Pastoral</p>
          </div>
        )}

        {/* LOGIN UNIFICADO (COM CONTEXTO DE ROLE) */}
        {view === AppView.LOGIN && (
          <div className="pt-20 animate-in slide-in-from-right duration-300">
            <IconButton onClick={() => setView(AppView.SELECTION)} className="mb-8"><Icons.ArrowLeft /></IconButton>
            <h2 className="text-3xl font-black mb-2">Acesso {userRole === 'pastor' ? 'Pastoral' : 'Discipulador'}</h2>
            <p className="text-gray-500 mb-8">Entre com suas credenciais.</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input required type="email" placeholder="E-mail" className="w-full p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 outline-none" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
              <input required type="password" placeholder="Senha" className="w-full p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 outline-none" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
              <button type="submit" className="w-full p-5 text-white font-black rounded-2xl shadow-xl transition-all bg-indigo-600">Entrar</button>
            </form>
            <div className="mt-8 text-center"><button onClick={() => setView(AppView.REGISTER)} className="text-sm font-bold text-gray-500 hover:text-white transition-colors">Não tem conta? Crie agora</button></div>
          </div>
        )}

        {/* REGISTRO (ADAPTADO PARA ROLE) */}
        {view === AppView.REGISTER && (
          <div className="pt-20 animate-in slide-in-from-right duration-300">
            <IconButton onClick={() => setView(AppView.LOGIN)} className="mb-8"><Icons.ArrowLeft /></IconButton>
            <h2 className="text-3xl font-black mb-2">Novo {userRole === 'pastor' ? 'Pastor' : 'Discipulador'}</h2>
            <p className="text-gray-500 mb-8">Crie sua conta para gerenciar.</p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center overflow-hidden relative cursor-pointer hover:border-indigo-500 transition-all bg-gray-50 dark:bg-gray-900">
                  {regForm.photo ? <img src={regForm.photo} className="w-full h-full object-cover" /> : <Icons.User />}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <p className="text-[10px] font-black uppercase mt-2 opacity-50">Foto</p>
              </div>

              <input required placeholder="Seu Nome" className="w-full p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 outline-none" value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} />

              {userRole === 'discipulador' && (
                <>
                  <input required placeholder="Nome do Discipulado" className="w-full p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 outline-none" value={regForm.discipleship} onChange={e => setRegForm({ ...regForm, discipleship: e.target.value })} />
                  <div className="mt-4 p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                    <p className="text-xs font-black uppercase text-indigo-500 mb-2">SENHA DA EQUIPE (4 DÍGITOS)</p>
                    <input required maxLength={4} placeholder="0000" className="w-full bg-transparent text-2xl font-black tracking-widest outline-none" value={regForm.pin} onChange={e => setRegForm({ ...regForm, pin: e.target.value.slice(0, 4) })} />
                    <p className="text-[10px] opacity-60 mt-1">Compartilhe esta senha com seus líderes.</p>
                  </div>
                </>
              )}

              <input required type="email" placeholder="E-mail" className="w-full p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 outline-none" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
              <input required type="password" placeholder="Senha (Login)" className="w-full p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 outline-none" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
              <button type="submit" className="w-full p-5 text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all bg-green-600">Finalizar Cadastro</button>
            </form>
          </div>
        )}

        {/* PASTOR DASHBOARD - MACRO VIEW */}
        {view === AppView.PASTOR_DASHBOARD && (
          <div className="pt-20 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div onClick={handleTriggerPhotoUpload} className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg border-2 border-white dark:border-gray-800 cursor-pointer hover:opacity-80 transition-opacity bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center relative group">
                  {pastorProfile?.photo ? <img src={pastorProfile.photo} className="w-full h-full object-cover" /> : <div className="text-indigo-500"><Icons.User /></div>}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Edit /></div>
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight">Visão Pastoral</h1>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">Supervisão Geral</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView(AppView.RANKING)} className="p-3 bg-white dark:bg-[#1f2937] rounded-full border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all text-indigo-500">🏆</button>
                <button onClick={() => { fetchAllNetworkLeaders(); setIsAllLeadersModalOpen(true); }} className="p-3 bg-white dark:bg-[#1f2937] rounded-full border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all text-indigo-500"><Icons.Users /></button>
                <button onClick={() => setIsPastorExportModalOpen(true)} className="p-3 bg-white dark:bg-[#1f2937] rounded-full border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all text-gray-500"><Icons.Clipboard /></button>
                <IconButton onClick={handleLogout}><Icons.ArrowLeft /></IconButton>
              </div>
            </div>

            {/* Seletor de Semana */}
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-gray-200 dark:border-gray-800 mb-6 shadow-sm">
              <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsWeekSelectorOpen(!isWeekSelectorOpen)}>
                <div><p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60">PERÍODO ATUAL</p><h2 className="font-bold text-lg">{selectedWeek.label}</h2></div>
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">{isWeekSelectorOpen ? <Icons.ChevronUp /> : <Icons.ChevronDown />}</div>
              </div>
              {isWeekSelectorOpen && (
                <div className="mt-6 space-y-6 animate-in slide-in-from-top-2">
                  {MONTHS.map(m => (
                    <div key={m.name}>
                      <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-100 dark:border-gray-800 pb-2">{m.name}</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {m.weeks.map(w => (
                          <button key={w.id} onClick={() => { setSelectedWeek({ ...w, label: `Semana ${w.n} de ${m.name.split(' ')[0]}`, month: m.name }); setIsWeekSelectorOpen(false); }} style={{ backgroundColor: selectedWeek.id === w.id ? `#4F46E515` : undefined, borderColor: selectedWeek.id === w.id ? '#4F46E5' : undefined, color: selectedWeek.id === w.id ? '#4F46E5' : undefined }} className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${selectedWeek.id !== w.id ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400' : ''}`}>
                            <span className="text-[10px] font-bold uppercase">Semana {w.n}</span><span className="text-xs font-black">{w.range}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Big Numbers da Rede */}
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-[32px] p-8 text-white mb-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              <div className="relative z-10">
                <h2 className="font-bold opacity-80 mb-4 border-b border-white/10 pb-2">Resultados Consolidados</h2>
                <div className="flex justify-between gap-4">
                  <div><p className="text-[10px] font-black opacity-60 uppercase mb-1">TOTAL CÉLULA</p><p className="text-4xl font-black">{pastorSummary.reduce((acc, s) => acc + (s.total_cell || 0), 0)}</p></div>
                  <div className="text-right"><p className="text-[10px] font-black opacity-60 uppercase mb-1">TOTAL CULTO</p><p className="text-4xl font-black text-emerald-300">{pastorSummary.reduce((acc, s) => acc + (s.total_worship || 0), 0)}</p></div>
                </div>
              </div>
            </div>

            {/* Lista Detalhada */}
            <div className="flex justify-between items-end mb-4">
              <h3 className="font-black text-xl">Detalhamento</h3>
              <button onClick={() => { fetchDisciplesForLinking(); setIsLinkDiscipleModalOpen(true); }} className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-indigo-500 transition-all">+ VINCULAR</button>
            </div>

            <div className="space-y-4">
              {myDisciples.map(d => {
                const summary = pastorSummary.find(s => s.discipulador_id === d.id) || { total_cell: 0, total_worship: 0 };
                return (
                  <div key={d.id} onClick={() => fetchDiscipleDetails(d)} className="bg-white dark:bg-[#111827] p-5 rounded-3xl border border-gray-100 dark:border-gray-800 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-95">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border-2 border-white dark:border-gray-700 shadow-sm">{d.discipuladorPhoto && <img src={d.discipuladorPhoto} className="w-full h-full object-cover" />}</div>
                      <div><h4 className="font-bold text-lg">{d.name}</h4><p className="text-xs opacity-60">{d.discipuladorName}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-2xl">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase">Célula</p>
                        <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{summary.total_cell || 0}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-2xl">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase">Culto</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{summary.total_worship || 0}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {myDisciples.length === 0 && <p className="text-center py-10 opacity-40 italic">Nenhum discipulado vinculado ainda.</p>}
            </div>
          </div>
        )}

        {/* MODAL VINCULAR DISCIPULO (PASTOR) */}
        {isLinkDiscipleModalOpen && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0f172a] w-full max-w-sm rounded-[40px] border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col shadow-2xl max-h-[80vh]">
              <div className="p-8 pb-4 flex justify-between items-center"><h2 className="text-xl font-black">Vincular Discipulado</h2><button onClick={() => setIsLinkDiscipleModalOpen(false)} className="text-gray-400 p-2"><Icons.X /></button></div>
              <div className="p-8 pt-0 flex-1 overflow-y-auto">
                <div className="space-y-3">
                  {availableDiscipleships.map(d => (
                    <button key={d.id} onClick={() => linkDisciple(d.id)} className="w-full p-4 bg-gray-50 dark:bg-black/40 rounded-2xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-transparent hover:border-indigo-500">
                      <h4 className="font-bold">{d.name}</h4><p className="text-xs opacity-60">{d.discipuladorName}</p>
                    </button>
                  ))}
                  {availableDiscipleships.length === 0 && <p className="text-center opacity-40 text-sm">Nenhum discipulador disponível.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHOOSE DISCIPULSHIP (PUB) + PIN MODAL */}
        {view === AppView.CHOOSE_DISCIPLESHIP && (
          <div className="pt-20 animate-in slide-in-from-right duration-300">
            <IconButton onClick={() => setView(AppView.SELECTION)} className="mb-8"><Icons.ArrowLeft /></IconButton>
            <h2 className="text-3xl font-black mb-2">Selecione o Discipulado</h2>
            <p className="text-gray-500 mb-10">Encontre seu discipulador.</p>
            <div className="space-y-4">
              {publicDiscipleships.map(d => (
                <button key={d.id} onClick={() => { setPendingDiscipleship(d); setPinModalOpen(true); }} className="w-full p-6 bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-gray-800 flex items-center gap-5 hover:shadow-xl transition-all group">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-gray-800">
                    {d.discipuladorPhoto ? <img src={d.discipuladorPhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-500"><Icons.User /></div>}
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-lg">{d.name}</h3>
                    <p className="text-gray-500 text-sm">Discipulador: {d.discipuladorName}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PIN MODAL */}
        {pinModalOpen && pendingDiscipleship && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in duration-300">
            <div className="w-full max-w-xs text-center">
              <div className="w-20 h-20 bg-white/10 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl">🔒</div>
              <h2 className="text-2xl font-black text-white mb-2">Acesso Restrito</h2>
              <p className="text-white/50 mb-8 text-sm">Digite a senha de 4 dígitos do discipulado <strong>{pendingDiscipleship.name}</strong> para continuar.</p>

              <div className="flex justify-center gap-4 mb-10">
                {pinInput.map((digit, idx) => (
                  <input key={idx} id={`pin-${idx}`} type="number" maxLength={1} value={digit} onChange={(e) => handlePinChange(idx, e.target.value)} className="w-14 h-20 rounded-2xl bg-white/10 border-2 border-white/20 text-center text-3xl font-black text-white focus:border-indigo-500 focus:bg-indigo-500/20 outline-none transition-all" />
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setPinModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-white/40 hover:bg-white/10 transition-all">Cancelar</button>
                <button onClick={handlePinSubmit} className="flex-1 py-4 bg-indigo-600 rounded-2xl font-bold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/30">Entrar</button>
              </div>
            </div>
          </div>
        )}

        {/* (RESTANTE DO CÓDIGO - LEADER LIST, DASHBOARDS ANTIGOS, ETC - Mantidos iguais, apenas inseridos no retorno) */}

        {/* DISCIPLE DASHBOARD (Original renomeado) */}
        {view === AppView.DISCIPLE_DASHBOARD && activeDiscipleship && (
          <div className="pt-20 animate-in fade-in duration-500">
            {/* Cabeçalho */}
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-3">
                <div onClick={handleTriggerPhotoUpload} className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg border-2 border-white dark:border-gray-800 cursor-pointer hover:opacity-80 transition-opacity relative group">
                  {activeDiscipleship.discipuladorPhoto ? <img src={activeDiscipleship.discipuladorPhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500"><Icons.User /></div>}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Edit /></div>
                </div>
                <div>
                  <h1 className="text-lg font-black leading-tight tracking-tight">Dashboard</h1>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{activeDiscipleship.name}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView(AppView.RANKING)} className="p-3 bg-white dark:bg-[#1f2937] rounded-full border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">🏆</button>
                {/* Só mostra botão de adicionar líder se for o próprio discipulador logado */}
                {session && session.user.id === activeDiscipleship.id && (
                  <IconButton onClick={() => setIsLeadersModalOpen(true)}><Icons.Users /></IconButton>
                )}
                <IconButton onClick={handleLogout}><Icons.ArrowLeft /></IconButton>
              </div>
            </div>

            {(notifPermission !== 'granted' || !activeDiscipleship?.push_token) && (
              <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-[28px] p-6 mb-8 flex items-center justify-between animate-in slide-in-from-top duration-500">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-500/20">🔔</div>
                  <div>
                    <p className="text-sm font-black leading-tight mb-1">Alertas em tempo real</p>
                    <p className="text-[10px] font-medium opacity-60">Receba avisos quando seus líderes enviarem relatórios.</p>
                    {isIOS && !isStandalone && (
                      <p className="text-[10px] font-bold text-indigo-500 mt-1 uppercase tracking-tight">📱 iPhone: Adicione à Tela de Início primeiro</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => requestNotificationPermission(activeDiscipleship.id, 'discipulador')}
                  className="ml-4 px-6 py-3 bg-indigo-600 text-white text-[10px] font-black rounded-xl shadow-xl active:scale-95 transition-all"
                >
                  ATIVAR
                </button>
              </div>
            )}

            {/* Seletor Semana */}
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-gray-200 dark:border-gray-800 mb-6 shadow-sm">
              <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsWeekSelectorOpen(!isWeekSelectorOpen)}>
                <div><p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60">PERÍODO ATUAL</p><h2 className="font-bold text-lg">{selectedWeek.label}</h2></div>
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">{isWeekSelectorOpen ? <Icons.ChevronUp /> : <Icons.ChevronDown />}</div>
              </div>
              {isWeekSelectorOpen && (
                <div className="mt-6 space-y-6 animate-in slide-in-from-top-2">
                  {MONTHS.map(m => (
                    <div key={m.name}>
                      <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-100 dark:border-gray-800 pb-2">{m.name}</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {m.weeks.map(w => (
                          <button key={w.id} onClick={() => { setSelectedWeek({ ...w, label: `Semana ${w.n} de ${m.name.split(' ')[0]}`, month: m.name }); setIsWeekSelectorOpen(false); }} style={{ backgroundColor: selectedWeek.id === w.id ? `${activePalette.primary}15` : undefined, borderColor: selectedWeek.id === w.id ? activePalette.primary : undefined, color: selectedWeek.id === w.id ? activePalette.primary : undefined }} className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${selectedWeek.id !== w.id ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400' : ''}`}>
                            <span className="text-[10px] font-bold uppercase">Semana {w.n}</span><span className="text-xs font-black">{w.range}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cards Totais */}
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="rounded-[32px] p-6 flex flex-col items-center shadow-lg relative overflow-hidden" style={{ backgroundColor: activePalette.primary }}>
                <p className="text-[9px] font-black uppercase mb-2 text-white/60 tracking-widest">CÉLULA</p><span className="text-5xl font-black text-white tracking-tighter">{totals.cell}</span>
              </div>
              <div className="bg-emerald-600 rounded-[32px] p-6 flex flex-col items-center shadow-lg relative overflow-hidden">
                <p className="text-[9px] font-black uppercase mb-2 text-emerald-100/60 tracking-widest">CULTO</p><span className="text-5xl font-black text-white tracking-tighter">{totals.worship}</span>
              </div>
            </div>

            {/* Lista Líderes Cards */}
            <div className="space-y-3 mb-10">
              {leaders.map(l => {
                const r = reports.find(rep => rep.leaderId === l.id && rep.weekId === selectedWeek.id);
                const cell = r?.cellCount || 0;
                const worship = r?.worshipCount || 0;
                const diff = worship - cell;

                return (
                  <div key={l.id} className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-lg leading-tight">{l.name}</h4>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${diff >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{diff >= 0 ? '+' : ''}{diff} Saldo</span>
                      </div>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activePalette.primary }}></div>
                          <span className="text-xs font-black opacity-60">Cél: {cell}{r?.goalCell || l.goal_cell ? `/${r?.goalCell || l.goal_cell}` : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-xs font-black opacity-60">Culto: {worship}{r?.goalWorship || l.goal_worship ? `/${r?.goalWorship || l.goal_worship}` : ''}</span>
                        </div>
                      </div>
                    </div>
                    {session && (
                      <div className="flex gap-2 ml-2">
                        <button onClick={() => openGoalModal(l)} className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl text-indigo-500 hover:bg-indigo-100 transition-colors"><Icons.Goal /></button>
                        <button onClick={() => { setCurrentDeleteLeader(l); setIsDeleteModalOpen(true); }} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 transition-colors text-red-500"><Icons.Trash /></button>
                      </div>
                    )}
                  </div>
                );
              })}
              {leaders.length === 0 && <p className="text-center opacity-40 italic py-10">Nenhum líder cadastrado.</p>}
            </div>

            {/* Ações */}
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => setIsImageModalOpen(true)} className="w-full bg-white dark:bg-[#111827] text-gray-800 dark:text-white font-black py-5 rounded-[24px] flex items-center justify-center gap-3 border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-indigo-500 transition-all active:scale-95 shadow-sm">
                <svg className="w-6 h-6" style={{ color: activePalette.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>Gerar Relatório Visual Premium
              </button>
              <button onClick={() => setIsReportTextModalOpen(true)} className="w-full text-white font-black py-5 rounded-[24px] flex items-center justify-center gap-3 shadow-xl hover:opacity-90 active:scale-95 transition-all" style={{ backgroundColor: activePalette.primary }}><Icons.Clipboard /> Copiar Resumo em Texto</button>
            </div>

            {/* Modal Leaders */}
            {isLeadersModalOpen && (
              <div className="fixed inset-0 z-[170] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm transition-all animate-in fade-in duration-300">
                <div className="bg-white dark:bg-[#0f172a] w-full max-w-sm rounded-[40px] border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-8 pb-4 flex justify-between items-center"><h2 className="text-2xl font-black">Líderes</h2><button onClick={() => setIsLeadersModalOpen(false)} className="text-gray-400 p-2"><Icons.X /></button></div>
                  <div className="p-8 pt-4 flex-1 overflow-y-auto max-h-[400px]">
                    <div className="flex gap-2 mb-8">
                      <input type="text" placeholder="Novo líder..." value={newLeaderName} onChange={(e) => setNewLeaderName(e.target.value)} className="flex-1 bg-gray-50 dark:bg-black border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4" />
                      <button onClick={addLeader} className="rounded-2xl px-5 flex items-center justify-center shadow-lg" style={{ backgroundColor: activePalette.primary }}><Icons.PlusSimple /></button>
                    </div>
                    <div className="space-y-3">
                      {leaders.map(l => (
                        <div key={l.id} className="bg-gray-50 dark:bg-black/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex justify-between items-center">
                          <span className="font-bold">{l.name}</span><button onClick={() => removeLeader(l.id)} className="p-2"><Icons.Trash /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-8 pt-0"><button onClick={() => setIsLeadersModalOpen(false)} className="w-full bg-gray-100 dark:bg-gray-800 font-bold py-5 rounded-2xl">CONCLUÍDO</button></div>
                </div>
              </div>
            )}

            {/* Modal Image e Texto (Mantidos) */}
            {isImageModalOpen && (
              <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl transition-all animate-in fade-in duration-300">
                <div className="bg-white dark:bg-[#0f172a] w-full max-w-sm rounded-[40px] overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-6 flex justify-between items-center border-b border-gray-100 dark:border-gray-800"><h2 className="text-xl font-black tracking-tight">Relatório Visual</h2><button onClick={() => setIsImageModalOpen(false)} className="text-gray-400 p-2"><Icons.X /></button></div>
                  <div className="p-4 flex justify-center bg-gray-50 dark:bg-black/20"><canvas ref={canvasRef} width={500} height={800} className="w-full max-w-[280px] h-auto rounded-[32px] shadow-2xl border border-gray-100 dark:border-gray-800" /></div>
                  <div className="p-6"><button onClick={() => { const link = document.createElement('a'); link.download = 'Relatorio.png'; link.href = canvasRef.current!.toDataURL(); link.click(); }} className="w-full text-white font-black py-5 rounded-3xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all" style={{ backgroundColor: activePalette.primary }}>BAIXAR IMAGEM</button></div>
                </div>
              </div>
            )}
            {isReportTextModalOpen && (
              <div className="fixed inset-0 z-[180] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm transition-all animate-in fade-in duration-300">
                <div className="bg-white dark:bg-[#0f172a] w-full max-w-sm rounded-[40px] border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col shadow-2xl max-h-[90vh]">
                  <div className="p-8 pb-3 flex justify-between items-center border-b border-gray-50 dark:border-gray-900"><h2 className="text-xl font-black">WhatsApp Report</h2><button onClick={() => setIsReportTextModalOpen(false)} className="text-gray-400 p-2"><Icons.X /></button></div>
                  <div className="p-8 flex-1 overflow-y-auto bg-gray-50 dark:bg-[#020617]"><div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-300 border-l-4 border-l-indigo-500">{generateWhatsAppText()}</div></div>
                  <div className="p-8 pt-4"><button onClick={() => { navigator.clipboard.writeText(generateWhatsAppText()); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); }} className={`w-full font-black py-5 rounded-[24px] flex items-center justify-center gap-3 shadow-xl transition-all ${copyFeedback ? 'bg-emerald-600 scale-95' : 'hover:opacity-90 active:scale-95'}`} style={{ backgroundColor: copyFeedback ? undefined : activePalette.primary, color: 'white' }}>{copyFeedback ? 'Copiado!' : 'Copiar para WhatsApp'}</button></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LEADER LIST + DASHBOARD (Mesma lógica de antes, view protegida pelo PIN agora) */}
        {view === AppView.LEADER_LIST && activeDiscipleship && (
          <div className="pt-20 flex flex-col min-h-screen animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-4 mb-10"><IconButton onClick={() => setView(session ? AppView.DISCIPLE_DASHBOARD : AppView.CHOOSE_DISCIPLESHIP)}><Icons.ArrowLeft /></IconButton><h1 className="text-2xl font-black tracking-tight">Qual o seu nome?</h1></div>
            <div className="space-y-3">
              {leaders.map(l => (
                <button key={l.id} onClick={async () => {
                  setCurrentLeader(l);
                  setView(AppView.LEADER_DASHBOARD);
                  // Sincronizar token do líder
                  try {
                    const OneSignal = (window as any).OneSignal;
                    if (OneSignal) {
                      await OneSignal.Notifications.requestPermission();
                      const pushId = OneSignal.User.PushSubscription.id;
                      if (pushId) {
                        await supabase.from('leaders').update({ push_token: pushId }).eq('id', l.id);
                        setCurrentLeader({ ...l, push_token: pushId });
                      }
                    }
                  } catch (e) { }
                }} className="w-full p-6 bg-white dark:bg-[#111827] rounded-3xl border border-gray-100 dark:border-gray-800 flex justify-between items-center hover:shadow-xl transition-all group">
                  <span className="font-bold text-lg">{l.name}</span><div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 group-hover:bg-indigo-500 group-hover:text-white transition-all"><Icons.ChevronRight /></div>
                </button>
              ))}
              {leaders.length === 0 && <div className="py-20 text-center opacity-40"><p className="italic">O discipulador precisa cadastrar os líderes primeiro.</p></div>}
            </div>
          </div>
        )}

        {view === AppView.LEADER_DASHBOARD && currentLeader && (
          <div className="pt-20 animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-4 mb-10">
              <IconButton onClick={() => setView(AppView.LEADER_LIST)}><Icons.ArrowLeft /></IconButton>
              <div><h1 className="text-2xl font-black tracking-tight">Olá, {currentLeader.name}</h1><p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Lançamento de Presença</p></div>
            </div>

            {/* DEBUG INFO - REMOVER DEPOIS */}
            <div className="bg-gray-100 p-2 text-[10px] mb-4 overflow-auto hidden">
              JSON: {JSON.stringify({ id: currentLeader.id, goals: { cell: currentLeader.goal_cell, worship: currentLeader.goal_worship }, push: currentLeader.push_token, perm: notifPermission })}
            </div>

            {(notifPermission !== 'granted' || !currentLeader?.push_token) && (
              <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-[28px] p-6 mb-8 flex items-center justify-between animate-in slide-in-from-top duration-500">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg shadow-emerald-500/20">⏰</div>
                  <div>
                    <p className="text-sm font-black leading-tight mb-1 text-emerald-700 dark:text-emerald-400">Lembrete de Envio</p>
                    <p className="text-[10px] font-medium opacity-60 text-emerald-800 dark:text-emerald-500">Deseja ser lembrado de enviar o relatório no final de semana?</p>
                    {isIOS && !isStandalone && (
                      <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-tight">📱 iPhone: Adicione à Tela de Início primeiro</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => requestNotificationPermission(currentLeader.id, 'leader')}
                  className="ml-4 px-6 py-3 bg-emerald-600 text-white text-[10px] font-black rounded-xl shadow-xl active:scale-95 transition-all"
                >
                  SIM
                </button>
              </div>
            )}
            <div className="space-y-6">
              {[
                { type: 'cell' as const, label: 'PRESENÇA CÉLULA', themeColor: activePalette.primary },
                { type: 'worship' as const, label: 'PRESENÇA CULTO', themeColor: '#10B981' }
              ].map(card => {
                const report = reports.find(r => r.leaderId === currentLeader.id && r.weekId === selectedWeek.id) || { cellCount: 0, worshipCount: 0, cellSent: false, worshipSent: false };
                const isSent = card.type === 'cell' ? report.cellSent : report.worshipSent;
                const isSending = sendingStatus[`${currentLeader.id}-${selectedWeek.id}-${card.type}`];
                const count = card.type === 'cell' ? report.cellCount : report.worshipCount;
                const goal = card.type === 'cell' ? Number(report.goalCell || currentLeader.goal_cell || 0) : Number(report.goalWorship || currentLeader.goal_worship || 0);

                let feedbackNode = null;
                if (isSent) {
                  if (goal > 0) {
                    const diff = count - goal;
                    feedbackNode = (
                      <div className="text-center font-black animate-in zoom-in text-white">
                        <div className="text-5xl mb-2">{diff >= 0 ? '🏆' : '💪'}</div>
                        <h3 className="text-xl uppercase mb-1">{diff >= 0 ? 'PARABÉNS!' : 'CONTINUE!'}</h3>
                        <p className="text-sm opacity-90">{diff === 0 ? 'Meta atingida!' : diff > 0 ? `Superou em ${diff}!` : `Faltaram ${Math.abs(diff)}`}</p>
                      </div>
                    );
                  } else {
                    feedbackNode = <div className="text-center font-black animate-in zoom-in"><div className="text-5xl mb-2">✅</div>RELATÓRIO SALVO</div>;
                  }
                }

                return (
                  <div key={card.type} className="bg-white dark:bg-[#111827] rounded-[32px] p-8 border border-gray-100 dark:border-gray-800 relative shadow-sm overflow-hidden">
                    {(isSending || isSent) && (
                      <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-md transition-all duration-500 ${isSent ? (goal > 0 && count >= goal ? 'bg-indigo-600/90' : goal > 0 ? 'bg-gray-900/90' : 'text-white') : 'bg-white/90 dark:bg-[#111827]/90'}`} style={{ backgroundColor: (isSent && goal === 0) ? `${card.themeColor}F2` : undefined }}>
                        {isSending ? <div className="animate-spin w-10 h-10 border-4 border-t-transparent rounded-full" style={{ borderColor: card.themeColor }}></div> : feedbackNode}
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-6">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{card.label}</p>
                      {goal > 0 && <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500">META: {goal}</span>}
                    </div>
                    <div className="bg-gray-50 dark:bg-black/40 rounded-[24px] py-10 flex items-center justify-center mb-6">
                      <input type="number" disabled={isSent || isSending} value={count === 0 ? '' : count} onChange={(e) => handleManualUpdateReport(currentLeader.id, selectedWeek.id, card.type, e.target.value)} placeholder="0" className="bg-transparent text-6xl font-black text-center w-full focus:outline-none dark:text-white tracking-tighter" />
                    </div>
                    <button onClick={() => handleSendReport(currentLeader.id, selectedWeek.id, card.type)} disabled={isSent || isSending} style={{ backgroundColor: card.themeColor }} className="w-full text-white font-black py-5 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-30">{goal > 0 ? `ENVIAR E CONFERIR` : 'ENVIAR AGORA'}</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* RANKING VIEW */}
        {view === AppView.RANKING && (
          <div className="pt-20 animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Ranking Geral</h1>
                <p className="text-xs font-bold uppercase tracking-widest opacity-60">Top da Rede</p>
              </div>
              <IconButton onClick={() => {
                if (session) {
                  if (userRole === 'pastor') setView(AppView.PASTOR_DASHBOARD);
                  else setView(AppView.DISCIPLE_DASHBOARD);
                } else {
                  setView(AppView.SELECTION);
                }
              }}><Icons.ArrowLeft /></IconButton>
            </div>

            {/* Filtro: Semanal vs Mensal */}
            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-6">
              <button onClick={() => setRankingMode('weekly')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${rankingMode === 'weekly' ? 'bg-white dark:bg-[#111827] shadow-sm text-indigo-600' : 'text-gray-400'}`}>Semanal</button>
              <button onClick={() => setRankingMode('monthly')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${rankingMode === 'monthly' ? 'bg-white dark:bg-[#111827] shadow-sm text-indigo-600' : 'text-gray-400'}`}>Mensal</button>
            </div>

            {/* Seletor (Apenas Semanal por enquanto, Mensal pega o mês da semana selecionada) */}
            <div className="flex overflow-x-auto gap-3 mb-6 pb-2 snap-x">
              {MONTHS[0].weeks.map(w => (
                <button key={w.id} onClick={() => setSelectedWeek(w)} className={`snap-center shrink-0 px-4 py-2 rounded-xl font-bold text-xs border transition-all ${selectedWeek.id === w.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-gray-800'}`}>
                  {w.label.replace('Semana ', 'S')}
                </button>
              ))}
            </div>

            {/* Abas Tipo: Célula vs Culto */}
            <div className="flex gap-4 mb-6">
              <button onClick={() => setRankingTab('cell')} className={`flex-1 p-4 rounded-2xl border-2 font-black transition-all ${rankingTab === 'cell' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-gray-200 dark:border-gray-800 opacity-60'}`}>🏠 Célula</button>
              <button onClick={() => setRankingTab('worship')} className={`flex-1 p-4 rounded-2xl border-2 font-black transition-all ${rankingTab === 'worship' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-gray-200 dark:border-gray-800 opacity-60'}`}>⛪ Culto</button>
            </div>

            {/* Lista Ranking */}
            <div className="space-y-3 pb-20">
              {rankingData
                .sort((a, b) => (rankingTab === 'cell' ? b.total_cell - a.total_cell : b.total_worship - a.total_worship))
                .map((item, idx) => {
                  const val = rankingTab === 'cell' ? item.total_cell : item.total_worship;
                  const isTop3 = idx < 3;
                  const color = rankingTab === 'cell' ? '#3B82F6' : '#10B981';
                  return (
                    <div key={item.leader_id} className={`relative flex items-center p-4 rounded-3xl border ${isTop3 ? 'bg-white dark:bg-[#1e293b] border-indigo-500/30 shadow-lg scale-105 my-4 z-10' : 'bg-gray-50 dark:bg-[#111827] border-transparent'}`}>
                      <div className={`absolute -left-3 w-8 h-8 rounded-full flex items-center justify-center font-black text-white shadow-lg ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                        {idx + 1}
                      </div>
                      <div className="ml-6 flex-1">
                        <h4 className="font-bold">{item.leader_name}</h4>
                        <p className="text-[10px] opacity-60 uppercase">{item.discipulador_name || item.discipleship_name}</p>
                      </div>
                      <div className="text-2xl font-black" style={{ color }}>{val}</div>
                    </div>
                  )
                })
              }
              {rankingData.length === 0 && <p className="text-center opacity-40 py-10">Sem dados para este período.</p>}
            </div>
          </div>
        )}

        {/* MODAL DE METAS */}
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#111827] w-full max-w-xs rounded-[32px] p-8 shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <div className="flex justify-between items-center mb-8 relative z-10">
                <div>
                  <h2 className="font-black text-2xl tracking-tighter">Definir Alvo 🎯</h2>
                  <p className="text-xs font-bold uppercase opacity-50 tracking-widest">{formatName(currentGoalLeader?.name || '')}</p>
                </div>
                <button onClick={() => setIsGoalModalOpen(false)} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-200 transition-colors"><Icons.X /></button>
              </div>

              <div className="space-y-6 relative z-10">
                <div>
                  <label className="text-[10px] font-black uppercase text-indigo-500 mb-2 block tracking-widest">Alvo Célula</label>
                  <input type="number" autoFocus className="w-full text-4xl font-black bg-transparent border-b-2 border-gray-100 dark:border-gray-800 focus:border-indigo-500 outline-none pb-2 transition-all placeholder-gray-200 dark:placeholder-gray-800 text-indigo-600 dark:text-indigo-400" placeholder="0" value={goalForm.cell} onChange={e => setGoalForm({ ...goalForm, cell: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-emerald-500 mb-2 block tracking-widest">Alvo Culto</label>
                  <input type="number" className="w-full text-4xl font-black bg-transparent border-b-2 border-gray-100 dark:border-gray-800 focus:border-emerald-500 outline-none pb-2 transition-all placeholder-gray-200 dark:placeholder-gray-800 text-emerald-600 dark:text-emerald-400" placeholder="0" value={goalForm.worship} onChange={e => setGoalForm({ ...goalForm, worship: e.target.value })} />
                </div>
                <button onClick={handleSaveGoal} className="w-full py-4 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">SALVAR METAS</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL TODOS OS LÍDERES DA REDE (PASTOR) */}
        {isAllLeadersModalOpen && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#111827] w-full max-w-sm rounded-[32px] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <div><h2 className="font-black text-xl">Líderes da Rede</h2><p className="text-xs opacity-60">Nome Padrão & Discipulador</p></div>
                <button onClick={() => setIsAllLeadersModalOpen(false)}><Icons.X /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {allNetworkLeaders.map((l: any) => (
                  <div key={l.leader_id} className="p-4 bg-gray-50 dark:bg-black/30 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm">{formatName(l.leader_name)}</p>
                      <p className="text-[10px] uppercase opacity-50 tracking-wide">{formatName(l.discipulador_name)}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  </div>
                ))}
                {allNetworkLeaders.length === 0 && <p className="text-center opacity-40 p-10">Carregando...</p>}
              </div>
            </div>
          </div>
        )}

        {/* MODAL DETALHES PASTOR (REFINADO) */}
        {selectedDiscipleDetail && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-6 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#0f172a] w-full sm:max-w-md rounded-t-[40px] sm:rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[80vh] animate-in slide-in-from-bottom duration-500">
              {/* Header com Glassmorphism */}
              <div className="relative bg-indigo-600 p-8 pb-10 text-white overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 overflow-hidden shadow-inner">
                      {selectedDiscipleDetail.discipuladorPhoto ? <img src={selectedDiscipleDetail.discipuladorPhoto} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div>
                      <h2 className="font-black text-2xl leading-none mb-1">{selectedDiscipleDetail.name}</h2>
                      <p className="text-indigo-200 text-sm font-medium">{selectedDiscipleDetail.discipuladorName}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDiscipleDetail(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all"><Icons.X /></button>
                </div>
              </div>

              {/* Lista Scrollável */}
              <div className="flex-1 overflow-y-auto p-6 -mt-6 bg-gray-50 dark:bg-[#020617] rounded-t-[32px] relative z-20">
                <div className="flex justify-between items-end mb-6 px-2">
                  <p className="text-xs font-black uppercase text-gray-400 tracking-widest">Performance Semanal</p>
                  <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-3 py-1 rounded-full">{detailLeaders.length} Líderes</span>
                </div>

                <div className="space-y-3 pb-8">
                  {detailLeaders.map((l: any, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-white dark:bg-[#111827] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <span className="font-bold text-gray-700 dark:text-gray-200">{l.leader_name}</span>
                      <div className="flex gap-2">
                        <div className="flex flex-col items-center bg-indigo-50 dark:bg-indigo-900/10 px-3 py-2 rounded-xl min-w-[60px]">
                          <span className="text-[9px] font-black text-indigo-400 uppercase">Célula</span>
                          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{l.cell_count}</span>
                        </div>
                        <div className="flex flex-col items-center bg-emerald-50 dark:bg-emerald-900/10 px-3 py-2 rounded-xl min-w-[60px]">
                          <span className="text-[9px] font-black text-emerald-400 uppercase">Culto</span>
                          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{l.worship_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {detailLeaders.length === 0 && <div className="text-center py-10 opacity-30 italic">Nenhum dado lançado esta semana.</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EXPORTACAO PASTOR */}
        {isPastorExportModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#111827] w-full max-w-md rounded-[32px] p-6 shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-black text-2xl">Exportar Relatório</h2>
                <button onClick={() => setIsPastorExportModalOpen(false)} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full"><Icons.X /></button>
              </div>

              {/* Abas */}
              <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-6">
                <button onClick={() => setPastorExportTab('text')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${pastorExportTab === 'text' ? 'bg-white dark:bg-[#1f2937] shadow-sm text-indigo-600' : 'text-gray-400'}`}>Texto WhatsApp</button>
                <button onClick={() => { setPastorExportTab('image'); setTimeout(drawPastorNetworkImage, 100); }} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${pastorExportTab === 'image' ? 'bg-white dark:bg-[#1f2937] shadow-sm text-indigo-600' : 'text-gray-400'}`}>Imagem Stories</button>
              </div>

              <div className="flex-1 overflow-y-auto mb-6 bg-gray-50 dark:bg-[#020617] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 relative">
                {pastorExportTab === 'text' ? (
                  <div className="whitespace-pre-wrap font-mono text-xs text-gray-700 dark:text-gray-300">{generatePastorNetworkText()}</div>
                ) : (
                  <div className="flex justify-center bg-gray-200/50 dark:bg-black/50 p-2 rounded-xl">
                    <canvas ref={canvasRef} className="w-full max-w-[280px] h-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700" />
                  </div>
                )}
              </div>

              {pastorExportTab === 'text' ? (
                <button onClick={() => { navigator.clipboard.writeText(generatePastorNetworkText()); alert("Texto copiado!"); }} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all hover:bg-indigo-500">
                  <Icons.Clipboard /> COPIAR TEXTO
                </button>
              ) : (
                <button onClick={() => {
                  if (canvasRef.current) {
                    const link = document.createElement('a'); link.download = `RELATORIO_REDE_${selectedWeek.label.replace(/ /g, '_')}.png`;
                    link.href = canvasRef.current.toDataURL(); link.click();
                  }
                }} className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all hover:bg-emerald-400">
                  BAIXAR IMAGEM
                </button>
              )}
            </div>
          </div>
        )}

      </div>
      {/* MODAL DE EXCLUSÃO DE RELATÓRIO */}
      {isDeleteModalOpen && currentDeleteLeader && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111827] w-full max-w-xs rounded-[32px] p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"><Icons.Trash /></div>
              <h3 className="font-black text-lg">Apagar Relatório?</h3>
              <p className="text-sm opacity-60">Escolha qual dado deseja zerar de <strong>{formatName(currentDeleteLeader.name)}</strong>.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { clearReport(currentDeleteLeader.id, selectedWeek.id, 'cell'); setIsDeleteModalOpen(false); }} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider">Célula</button>
              <button onClick={() => { clearReport(currentDeleteLeader.id, selectedWeek.id, 'worship'); setIsDeleteModalOpen(false); }} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider">Culto</button>
            </div>
            <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-3 text-red-500 font-bold text-xs uppercase">Cancelar</button>
          </div>
        </div>
      )}

      {/* Hidden File Input for Profile Photo Update */}
      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleUpdateProfilePhoto} className="hidden" style={{ display: 'none' }} />

    </div>
  );
};

export default App;
