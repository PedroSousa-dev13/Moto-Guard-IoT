export interface PresetRoute {
  id: string;
  name: string;
  description: string;
  distance: string;
  duration: string;
  type: 'urbano' | 'nacional' | 'autoestrada' | 'serra' | 'costeira';
  difficulty: 'fácil' | 'médio' | 'difícil';
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  center: [number, number];
  zoom: number;
}

export interface District {
  name: string;
  region: string;
  routes: PresetRoute[];
}

export const DISTRICTS: District[] = [
  {
    name: 'Vila Real',
    region: 'Trás-os-Montes',
    routes: [
      {
        id: 'vr-centro-univ',
        name: 'Centro → Universidade',
        description: 'Percurso urbano pelo centro histórico de Vila Real até à UTAD.',
        distance: '1.3 km', duration: '~2 min',
        type: 'urbano', difficulty: 'fácil',
        start: { lat: 41.2951, lng: -7.7463 },
        end: { lat: 41.3045, lng: -7.7388 },
        center: [41.2998, -7.7426], zoom: 15,
      },
      {
        id: 'vr-mateus',
        name: 'Vila Real → Mateus',
        description: 'Nacional pela Quinta de Mateus, paisagem vinhateira do Douro.',
        distance: '4.2 km', duration: '~5 min',
        type: 'nacional', difficulty: 'fácil',
        start: { lat: 41.2951, lng: -7.7463 },
        end: { lat: 41.3180, lng: -7.7050 },
        center: [41.3065, -7.7257], zoom: 14,
      },
      {
        id: 'vr-sabrosa',
        name: 'Vila Real → Sabrosa',
        description: 'Nacional sinuosa pela serra do Marão, curvas técnicas e paisagem de altitude.',
        distance: '13 km', duration: '~15 min',
        type: 'serra', difficulty: 'difícil',
        start: { lat: 41.2951, lng: -7.7463 },
        end: { lat: 41.2700, lng: -7.5800 },
        center: [41.2826, -7.6632], zoom: 12,
      },
    ],
  },
  {
    name: 'Porto',
    region: 'Grande Porto',
    routes: [
      {
        id: 'porto-ribeira-foz',
        name: 'Ribeira → Foz do Douro',
        description: 'Marginal do Douro desde a Ribeira até à Foz, vista sobre o rio.',
        distance: '6.5 km', duration: '~10 min',
        type: 'urbano', difficulty: 'fácil',
        start: { lat: 41.1408, lng: -8.6140 },
        end: { lat: 41.1510, lng: -8.6760 },
        center: [41.1459, -8.6450], zoom: 14,
      },
      {
        id: 'porto-circunvalacao',
        name: 'Circunvalação Norte',
        description: 'Anel viário norte do Porto, tráfego misto e vias rápidas.',
        distance: '11 km', duration: '~12 min',
        type: 'nacional', difficulty: 'médio',
        start: { lat: 41.1760, lng: -8.5980 },
        end: { lat: 41.1850, lng: -8.6600 },
        center: [41.1805, -8.6290], zoom: 13,
      },
      {
        id: 'porto-a28-matosinhos',
        name: 'Porto → Matosinhos (A28)',
        description: 'Autoestrada litoral até Matosinhos, velocidades elevadas.',
        distance: '9 km', duration: '~8 min',
        type: 'autoestrada', difficulty: 'fácil',
        start: { lat: 41.1579, lng: -8.6291 },
        end: { lat: 41.1833, lng: -8.6980 },
        center: [41.1706, -8.6636], zoom: 13,
      },
    ],
  },
  {
    name: 'Braga',
    region: 'Minho',
    routes: [
      {
        id: 'braga-centro-bom-jesus',
        name: 'Centro → Bom Jesus',
        description: 'Subida ao santuário do Bom Jesus, estrada sinuosa com declive.',
        distance: '5.8 km', duration: '~8 min',
        type: 'serra', difficulty: 'médio',
        start: { lat: 41.5454, lng: -8.4265 },
        end: { lat: 41.5530, lng: -8.3780 },
        center: [41.5492, -8.4023], zoom: 14,
      },
      {
        id: 'braga-guimaraes',
        name: 'Braga → Guimarães',
        description: 'Nacional entre as duas cidades históricas do Minho.',
        distance: '22 km', duration: '~22 min',
        type: 'nacional', difficulty: 'fácil',
        start: { lat: 41.5454, lng: -8.4265 },
        end: { lat: 41.4425, lng: -8.2918 },
        center: [41.4940, -8.3592], zoom: 12,
      },
    ],
  },
  {
    name: 'Lisboa',
    region: 'Grande Lisboa',
    routes: [
      {
        id: 'lisboa-belem-cascais',
        name: 'Belém → Cascais',
        description: 'Marginal de Lisboa, estrada costeira com vista para o Tejo e Atlântico.',
        distance: '30 km', duration: '~30 min',
        type: 'costeira', difficulty: 'fácil',
        start: { lat: 38.6970, lng: -9.2060 },
        end: { lat: 38.6979, lng: -9.4215 },
        center: [38.6975, -9.3138], zoom: 12,
      },
      {
        id: 'lisboa-sintra',
        name: 'Lisboa → Sintra',
        description: 'IC19 e estradas da serra de Sintra, curvas técnicas e paisagem.',
        distance: '28 km', duration: '~28 min',
        type: 'serra', difficulty: 'médio',
        start: { lat: 38.7223, lng: -9.1393 },
        end: { lat: 38.7978, lng: -9.3900 },
        center: [38.7601, -9.2647], zoom: 12,
      },
      {
        id: 'lisboa-a2-setubal',
        name: 'Lisboa → Setúbal (A2)',
        description: 'Autoestrada sul, travessia da Ponte 25 de Abril e planície alentejana.',
        distance: '48 km', duration: '~35 min',
        type: 'autoestrada', difficulty: 'fácil',
        start: { lat: 38.7223, lng: -9.1393 },
        end: { lat: 38.5244, lng: -8.8882 },
        center: [38.6234, -9.0138], zoom: 11,
      },
    ],
  },
  {
    name: 'Faro',
    region: 'Algarve',
    routes: [
      {
        id: 'faro-lagos',
        name: 'Faro → Lagos',
        description: 'EN125 pelo Algarve, estrada nacional com aldeias e paisagem mediterrânica.',
        distance: '75 km', duration: '~60 min',
        type: 'nacional', difficulty: 'médio',
        start: { lat: 37.0194, lng: -7.9322 },
        end: { lat: 37.1028, lng: -8.6731 },
        center: [37.0611, -8.3027], zoom: 11,
      },
      {
        id: 'faro-monchique',
        name: 'Portimão → Monchique',
        description: 'Subida à serra de Monchique, estrada de montanha com curvas fechadas.',
        distance: '24 km', duration: '~25 min',
        type: 'serra', difficulty: 'difícil',
        start: { lat: 37.1359, lng: -8.5380 },
        end: { lat: 37.3190, lng: -8.5500 },
        center: [37.2275, -8.5440], zoom: 12,
      },
    ],
  },
  {
    name: 'Coimbra',
    region: 'Centro',
    routes: [
      {
        id: 'coimbra-lousã',
        name: 'Coimbra → Lousã',
        description: 'Nacional pela serra da Lousã, floresta densa e curvas técnicas.',
        distance: '28 km', duration: '~28 min',
        type: 'serra', difficulty: 'difícil',
        start: { lat: 40.2033, lng: -8.4103 },
        end: { lat: 40.1100, lng: -8.2490 },
        center: [40.1567, -8.3297], zoom: 12,
      },
      {
        id: 'coimbra-aveiro',
        name: 'Coimbra → Aveiro (A1)',
        description: 'Autoestrada entre as duas cidades universitárias.',
        distance: '55 km', duration: '~38 min',
        type: 'autoestrada', difficulty: 'fácil',
        start: { lat: 40.2033, lng: -8.4103 },
        end: { lat: 40.6443, lng: -8.6455 },
        center: [40.4238, -8.5279], zoom: 11,
      },
    ],
  },
];

export const TYPE_MAP: Record<PresetRoute['type'], { text: string; bg: string; label: string }> = {
  urbano: { text: 'text-blue', bg: 'bg-blue/15', label: 'Urbano' },
  nacional: { text: 'text-orange', bg: 'bg-orange/15', label: 'Nacional' },
  autoestrada: { text: 'text-purple', bg: 'bg-purple/15', label: 'Autoestrada' },
  serra: { text: 'text-green', bg: 'bg-green/15', label: 'Serra' },
  costeira: { text: 'text-cyan', bg: 'bg-cyan/15', label: 'Costeira' },
};

export const DIFF_MAP: Record<PresetRoute['difficulty'], string> = {
  'fácil': 'text-green',
  'médio': 'text-orange',
  'difícil': 'text-red',
};
