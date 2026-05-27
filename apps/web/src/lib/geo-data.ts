// Datos geograficos para droplists de direccion: paises + estados/provincias/
// departamentos. Cobertura: LATAM hispana + Brasil + EE.UU. + España.
//
// V1 hardcodeado para no depender de paquetes externos pesados. V2: si se
// necesita ciudades dropdown o cobertura mundial, considerar paquete
// `country-state-city` o API externa. Ver project_v2_geo_data.md.

export type RegionLabel = 'Estado' | 'Provincia' | 'Departamento' | 'Región' | 'Comunidad';

export interface Country {
  code: string;          // ISO 3166-1 alpha-2
  name: string;          // Nombre nativo (ej. "México")
  regionLabel: RegionLabel; // Como llaman al primer nivel administrativo
  regions: string[];     // Lista alfabetica de estados/provincias/etc.
}

export const COUNTRIES_GEO: Country[] = [
  {
    code: 'MX',
    name: 'México',
    regionLabel: 'Estado',
    regions: [
      'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
      'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
      'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
      'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
      'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
    ],
  },
  {
    code: 'AR',
    name: 'Argentina',
    regionLabel: 'Provincia',
    regions: [
      'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Ciudad Autónoma de Buenos Aires',
      'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
      'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
      'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
    ],
  },
  {
    code: 'CO',
    name: 'Colombia',
    regionLabel: 'Departamento',
    regions: [
      'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá',
      'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca',
      'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
      'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia',
      'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
    ],
  },
  {
    code: 'ES',
    name: 'España',
    regionLabel: 'Provincia',
    regions: [
      'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz',
      'Baleares', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón',
      'Ceuta', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada', 'Guadalajara',
      'Gipuzkoa', 'Huelva', 'Huesca', 'Jaén', 'La Rioja', 'Las Palmas', 'León', 'Lleida',
      'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra', 'Ourense', 'Palencia',
      'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria',
      'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Bizkaia', 'Zamora', 'Zaragoza',
    ],
  },
  {
    code: 'CL',
    name: 'Chile',
    regionLabel: 'Región',
    regions: [
      'Antofagasta', 'Arica y Parinacota', 'Atacama', 'Aysén', 'Biobío', 'Coquimbo',
      'La Araucanía', 'Libertador General Bernardo O\'Higgins', 'Los Lagos', 'Los Ríos',
      'Magallanes', 'Maule', 'Ñuble', 'Región Metropolitana', 'Tarapacá', 'Valparaíso',
    ],
  },
  {
    code: 'PE',
    name: 'Perú',
    regionLabel: 'Región',
    regions: [
      'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao',
      'Cusco', 'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque',
      'Lima', 'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín',
      'Tacna', 'Tumbes', 'Ucayali',
    ],
  },
  {
    code: 'VE',
    name: 'Venezuela',
    regionLabel: 'Estado',
    regions: [
      'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
      'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'Lara', 'Mérida',
      'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo',
      'Vargas', 'Yaracuy', 'Zulia',
    ],
  },
  {
    code: 'EC',
    name: 'Ecuador',
    regionLabel: 'Provincia',
    regions: [
      'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas',
      'Galápagos', 'Guayas', 'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago',
      'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas',
      'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe',
    ],
  },
  {
    code: 'GT',
    name: 'Guatemala',
    regionLabel: 'Departamento',
    regions: [
      'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula', 'El Progreso', 'Escuintla',
      'Guatemala', 'Huehuetenango', 'Izabal', 'Jalapa', 'Jutiapa', 'Petén', 'Quetzaltenango',
      'Quiché', 'Retalhuleu', 'Sacatepéquez', 'San Marcos', 'Santa Rosa', 'Sololá',
      'Suchitepéquez', 'Totonicapán', 'Zacapa',
    ],
  },
  {
    code: 'SV',
    name: 'El Salvador',
    regionLabel: 'Departamento',
    regions: [
      'Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad', 'La Paz', 'La Unión',
      'Morazán', 'San Miguel', 'San Salvador', 'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután',
    ],
  },
  {
    code: 'HN',
    name: 'Honduras',
    regionLabel: 'Departamento',
    regions: [
      'Atlántida', 'Choluteca', 'Colón', 'Comayagua', 'Copán', 'Cortés', 'El Paraíso',
      'Francisco Morazán', 'Gracias a Dios', 'Intibucá', 'Islas de la Bahía', 'La Paz',
      'Lempira', 'Ocotepeque', 'Olancho', 'Santa Bárbara', 'Valle', 'Yoro',
    ],
  },
  {
    code: 'NI',
    name: 'Nicaragua',
    regionLabel: 'Departamento',
    regions: [
      'Boaco', 'Carazo', 'Chinandega', 'Chontales', 'Costa Caribe Norte', 'Costa Caribe Sur',
      'Estelí', 'Granada', 'Jinotega', 'León', 'Madriz', 'Managua', 'Masaya', 'Matagalpa',
      'Nueva Segovia', 'Río San Juan', 'Rivas',
    ],
  },
  {
    code: 'CR',
    name: 'Costa Rica',
    regionLabel: 'Provincia',
    regions: ['Alajuela', 'Cartago', 'Guanacaste', 'Heredia', 'Limón', 'Puntarenas', 'San José'],
  },
  {
    code: 'PA',
    name: 'Panamá',
    regionLabel: 'Provincia',
    regions: [
      'Bocas del Toro', 'Chiriquí', 'Coclé', 'Colón', 'Darién', 'Emberá-Wounaan', 'Guna Yala',
      'Herrera', 'Los Santos', 'Ngäbe-Buglé', 'Panamá', 'Panamá Oeste', 'Veraguas',
    ],
  },
  {
    code: 'CU',
    name: 'Cuba',
    regionLabel: 'Provincia',
    regions: [
      'Artemisa', 'Camagüey', 'Ciego de Ávila', 'Cienfuegos', 'Granma', 'Guantánamo',
      'Holguín', 'Isla de la Juventud', 'La Habana', 'Las Tunas', 'Matanzas', 'Mayabeque',
      'Pinar del Río', 'Sancti Spíritus', 'Santiago de Cuba', 'Villa Clara',
    ],
  },
  {
    code: 'DO',
    name: 'República Dominicana',
    regionLabel: 'Provincia',
    regions: [
      'Azua', 'Bahoruco', 'Barahona', 'Dajabón', 'Distrito Nacional', 'Duarte', 'El Seibo',
      'Elías Piña', 'Espaillat', 'Hato Mayor', 'Hermanas Mirabal', 'Independencia',
      'La Altagracia', 'La Romana', 'La Vega', 'María Trinidad Sánchez', 'Monseñor Nouel',
      'Monte Cristi', 'Monte Plata', 'Pedernales', 'Peravia', 'Puerto Plata', 'Samaná',
      'San Cristóbal', 'San José de Ocoa', 'San Juan', 'San Pedro de Macorís', 'Sánchez Ramírez',
      'Santiago', 'Santiago Rodríguez', 'Santo Domingo', 'Valverde',
    ],
  },
  {
    code: 'BO',
    name: 'Bolivia',
    regionLabel: 'Departamento',
    regions: [
      'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz',
      'Tarija',
    ],
  },
  {
    code: 'PY',
    name: 'Paraguay',
    regionLabel: 'Departamento',
    regions: [
      'Alto Paraguay', 'Alto Paraná', 'Amambay', 'Asunción', 'Boquerón', 'Caaguazú', 'Caazapá',
      'Canindeyú', 'Central', 'Concepción', 'Cordillera', 'Guairá', 'Itapúa', 'Misiones',
      'Ñeembucú', 'Paraguarí', 'Presidente Hayes', 'San Pedro',
    ],
  },
  {
    code: 'UY',
    name: 'Uruguay',
    regionLabel: 'Departamento',
    regions: [
      'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida',
      'Lavalleja', 'Maldonado', 'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha',
      'Salto', 'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres',
    ],
  },
  {
    code: 'BR',
    name: 'Brasil',
    regionLabel: 'Estado',
    regions: [
      'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal',
      'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul',
      'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro',
      'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina',
      'São Paulo', 'Sergipe', 'Tocantins',
    ],
  },
  {
    code: 'US',
    name: 'Estados Unidos',
    regionLabel: 'Estado',
    regions: [
      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Carolina del Norte',
      'Carolina del Sur', 'Colorado', 'Connecticut', 'Dakota del Norte', 'Dakota del Sur',
      'Delaware', 'Distrito de Columbia', 'Florida', 'Georgia', 'Hawái', 'Idaho', 'Illinois',
      'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Luisiana', 'Maine', 'Maryland',
      'Massachusetts', 'Michigan', 'Minnesota', 'Misisipi', 'Misuri', 'Montana', 'Nebraska',
      'Nevada', 'Nueva Jersey', 'Nueva York', 'Nuevo Hampshire', 'Nuevo México', 'Ohio',
      'Oklahoma', 'Oregón', 'Pensilvania', 'Rhode Island', 'Tennessee', 'Texas', 'Utah',
      'Vermont', 'Virginia', 'Virginia Occidental', 'Washington', 'Wisconsin', 'Wyoming',
    ],
  },
];

export function getCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES_GEO.find((c) => c.code === code);
}

export function getRegionLabel(countryCode: string | null | undefined): RegionLabel {
  return getCountry(countryCode)?.regionLabel || 'Estado';
}

export function getRegions(countryCode: string | null | undefined): string[] {
  return getCountry(countryCode)?.regions || [];
}
