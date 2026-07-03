// ─────────────────────────────────────────────────────────────────────────────
// seed-catalog-descriptions.ts
//
// Rellena la descripción por defecto de cada servicio del catálogo global
// (ServiceCatalog.description). El superadmin puede editarlas después desde
// /platform/service-catalog, y cada negocio puede sobreescribir la suya al crear
// un servicio sin afectar la global.
//
// Idempotente: se puede correr las veces que sea. Actualiza por NOMBRE, así que
// cubre el mismo servicio en todas sus categorías (ej: "Balayage" en Colorista y
// Estilista). Solo escribe descripción donde el nombre coincide con el mapa.
//
// Uso:  npm run db:seed-catalog-desc   (o: npx ts-node prisma/seed-catalog-descriptions.ts)
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Descripciones por NOMBRE de servicio (client-facing, breves y claras).
const DESCRIPTIONS: Record<string, string> = {
  // ── Barbero/a ──
  'Afeitado tradicional con navaja': 'Afeitado al ras con navaja, toalla caliente y bálsamo para una piel suave y sin irritación.',
  'Arreglo de bigote': 'Recorte, perfilado y definición del bigote para mantenerlo prolijo y con forma.',
  'Corte de cabello clásico': 'Corte tradicional con tijera y máquina, adaptado a la forma de tu rostro y estilo.',
  'Corte degradado': 'Degradado limpio y progresivo en los laterales, con acabado prolijo y definido.',
  'Corte moderno / fade': 'Corte actual con fade a máquina y terminación detallada según la tendencia que prefieras.',
  'Diseño de barba': 'Diseño y contorno de barba a medida, con perfilado a navaja y productos de acabado.',
  'Exfoliación facial': 'Exfoliación que retira células muertas e impurezas, dejando la piel limpia, suave y luminosa.',
  'Lavado capilar': 'Lavado y masaje capilar con productos acordes a tu tipo de cabello.',
  'Limpieza facial básica': 'Limpieza facial que remueve impurezas y grasa, dejando el rostro fresco y saludable.',
  'Perfilado de barba': 'Perfilado y definición de los bordes de la barba para un contorno limpio y marcado.',
  'Rasurado de cabeza': 'Rasurado completo de cabeza al ras con navaja o máquina y acabado hidratante.',
  'Tinte de barba': 'Coloración de barba para cubrir canas o unificar el tono de forma natural.',
  'Tinte de cabello masculino': 'Coloración masculina para cubrir canas o cambiar de tono con un resultado natural.',

  // ── Colorista ──
  'Balayage': 'Mechas a mano alzada que crean un degradado natural, luminoso y de bajo mantenimiento.',
  'Corrección de color': 'Corrección profesional de tintes o decoloraciones previas para lograr el tono deseado.',
  'Decoloración': 'Aclarado del cabello para preparar la base antes de aplicar un nuevo color.',
  'Highlights': 'Mechas finas que aportan luz y dimensión al cabello de forma sutil y elegante.',
  'Matización': 'Neutralización de tonos no deseados (amarillos o naranjas) para un color pulido y uniforme.',
  'Mechas': 'Aplicación de mechas para dar luz, profundidad y movimiento a tu color.',
  'Retoque de raíz': 'Retoque del color en la raíz para mantener parejo el tono a medida que crece el cabello.',
  'Tinte completo': 'Coloración total del cabello con el tono que elijas y acabado uniforme.',
  'Tinte fantasía': 'Colores vibrantes y creativos (pasteles, neones o intensos) para un look único.',

  // ── Cosmetólogo/a ──
  'Depilación corporal con cera': 'Depilación con cera que retira el vello de raíz para una piel suave por más tiempo.',
  'Depilación facial': 'Depilación delicada del rostro para eliminar vello y definir facciones.',
  'Dermapen (microneedling)': 'Microneedling que estimula el colágeno para mejorar textura, marcas y firmeza de la piel.',
  'Diseño de cejas': 'Diseño y perfilado de cejas a la medida de tu rostro para enmarcar la mirada.',
  'Extensión de pestañas': 'Aplicación de pestañas una a una para una mirada más larga, densa y definida.',
  'Facial antiacné': 'Tratamiento facial que controla el acné, reduce la grasa y desinflama la piel.',
  'Facial antiedad': 'Facial que reduce líneas de expresión y aporta firmeza y luminosidad a la piel.',
  'Facial hidratante': 'Facial que repone la hidratación de la piel, dejándola suave, fresca y revitalizada.',
  'Hidrafacial': 'Limpieza profunda con hidratación e infusión de activos para una piel radiante al instante.',
  'Laminado de cejas': 'Fijado de las cejas hacia arriba para un efecto más poblado, peinado y duradero.',
  'Lash lifting': 'Permanente de pestañas que las curva y eleva para una mirada abierta y natural.',
  'Limpieza facial profunda': 'Limpieza profunda con extracción de impurezas y puntos negros para una piel renovada.',
  'Mascarillas especializadas': 'Mascarillas con activos según tu tipo de piel para nutrir, calmar o purificar.',
  'Peeling superficial': 'Exfoliación química suave que renueva la piel y mejora su textura y luminosidad.',
  'Radiofrecuencia facial': 'Tratamiento que estimula el colágeno para tensar y reafirmar la piel del rostro.',
  'Tinte de cejas': 'Coloración de cejas para intensificar y definir su forma de manera natural.',
  'Tratamientos reafirmantes faciales': 'Tratamiento que reafirma y tonifica la piel del rostro para un aspecto más firme.',

  // ── Esteticista ──
  'Cavitación': 'Técnica no invasiva que ayuda a reducir grasa localizada y a moldear la figura.',
  'Depilación con cera': 'Depilación con cera que retira el vello de raíz para una piel lisa y suave.',
  'Depilación láser': 'Depilación con láser que reduce el vello de forma progresiva y duradera.',
  'Maquillaje de novia': 'Maquillaje profesional de larga duración diseñado para tu día especial.',
  'Maquillaje profesional': 'Maquillaje a medida para eventos, sesiones o el día a día, con acabado impecable.',
  'Microdermoabrasión': 'Exfoliación mecánica que renueva la piel, atenúa marcas y mejora su textura.',
  'Radiofrecuencia corporal': 'Tratamiento que reafirma la piel del cuerpo y ayuda a reducir la flacidez.',
  'Tratamiento antiacné': 'Protocolo que controla el acné, reduce la inflamación y mejora el aspecto de la piel.',
  'Tratamiento antiedad': 'Tratamiento que combate los signos de la edad, aportando firmeza y luminosidad.',
  'Tratamiento reductor': 'Tratamiento corporal orientado a reducir medidas y moldear la silueta.',

  // ── Estilista ──
  'Alaciado (keratina / japonés)': 'Alaciado que reduce el frizz y deja el cabello liso, manejable y brillante por semanas.',
  'Botox capilar': 'Tratamiento que rellena y repara la fibra capilar, aportando suavidad y brillo.',
  'Cepillado': 'Peinado con cepillo y calor para un acabado liso, con cuerpo y movimiento.',
  'Corte de caballero': 'Corte masculino adaptado a tu estilo y tipo de cabello, con acabado prolijo.',
  'Corte de dama': 'Corte femenino personalizado según la forma de tu rostro y tu estilo.',
  'Corte infantil': 'Corte para niñas y niños en un ambiente cómodo y con paciencia.',
  'Hidratación capilar': 'Tratamiento que repone la hidratación del cabello, dejándolo suave y sedoso.',
  'Ondulado': 'Ondas definidas y con movimiento para un look natural o de evento.',
  'Peinado casual': 'Peinado sencillo y versátil para el día a día.',
  'Peinado social / evento': 'Peinado elaborado para bodas, fiestas y ocasiones especiales.',
  'Permanente': 'Rizos u ondas permanentes que dan volumen y textura duradera al cabello.',
  'Planchado': 'Alisado con plancha para un acabado liso, pulido y brillante.',
  'Reparación capilar': 'Tratamiento intensivo que repara el cabello dañado y restaura su salud.',
  'Tratamiento capilar intensivo': 'Tratamiento profundo que nutre y revitaliza el cabello de la raíz a las puntas.',

  // ── Manicurista ──
  'Diseño básico y avanzado': 'Decoración de uñas desde diseños sencillos hasta trabajos detallados y personalizados.',
  'Esculpido de uñas': 'Construcción de uñas esculpidas a medida para dar forma, largo y resistencia.',
  'Esmalte tradicional': 'Aplicación de esmalte tradicional con acabado prolijo y el color que elijas.',
  'Gelish / semipermanente': 'Esmaltado semipermanente de larga duración, brillo intenso y secado inmediato.',
  'Manicure': 'Cuidado completo de uñas y cutículas con esmaltado para unas manos prolijas.',
  'Manicure spa': 'Manicure con exfoliación, hidratación y masaje para consentir tus manos.',
  'Nail art': 'Arte y decoración creativa en uñas con diseños a tu gusto.',
  'Pedicure': 'Cuidado completo de pies, uñas y cutículas con esmaltado.',
  'Pedicure spa': 'Pedicure con exfoliación, hidratación y masaje para relajar y suavizar tus pies.',
  'Relleno / retoque de uñas': 'Relleno del crecimiento para mantener tus uñas parejas y con buen aspecto.',
  'Retiro de acrílico': 'Retiro seguro del acrílico sin dañar la uña natural.',
  'Retiro de gel': 'Retiro seguro del esmaltado en gel cuidando la uña natural.',
  'Spa de manos': 'Ritual de cuidado e hidratación profunda para manos suaves y renovadas.',
  'Spa de pies': 'Ritual de cuidado, exfoliación e hidratación para pies suaves y descansados.',
  'Uñas acrílicas': 'Uñas acrílicas resistentes y de larga duración con la forma y largo que prefieras.',
  'Uñas de gel': 'Uñas de gel con acabado natural, flexible y brillante de larga duración.',

  // ── Masajista ──
  'Aromaterapia': 'Masaje con aceites esenciales que relaja el cuerpo y equilibra las emociones.',
  'Drenaje linfático': 'Masaje suave que estimula la circulación linfática y ayuda a reducir la retención de líquidos.',
  'Envolturas corporales': 'Envoltura con activos que nutre, desintoxica y reafirma la piel del cuerpo.',
  'Exfoliación corporal': 'Exfoliación que retira células muertas dejando la piel suave y luminosa.',
  'Hidratación corporal': 'Tratamiento que repone la hidratación de la piel del cuerpo, dejándola tersa.',
  'Masaje anticelulitis': 'Masaje que trabaja las zonas con celulitis para mejorar la textura de la piel.',
  'Masaje con piedras calientes': 'Masaje con piedras calientes que relaja profundamente los músculos y libera tensión.',
  'Masaje deportivo': 'Masaje enfocado en músculos exigidos, ideal antes o después del ejercicio.',
  'Masaje descontracturante': 'Masaje profundo que libera contracturas y alivia la tensión muscular.',
  'Masaje reductivo': 'Masaje intenso que ayuda a moldear la figura y a reducir medidas.',
  'Masaje relajante': 'Masaje suave y envolvente para liberar el estrés y relajar cuerpo y mente.',
  'Ritual de spa': 'Experiencia completa de spa que combina varias técnicas para tu bienestar.',

  // ── Pedicurista ──
  'Esmaltado de pies': 'Aplicación de esmalte en las uñas de los pies con acabado prolijo.',
  'Exfoliación de pies': 'Exfoliación que elimina durezas y células muertas para pies suaves.',
  'Gelish en pies': 'Esmaltado semipermanente en pies, de larga duración y brillo intenso.',
  'Hidratación de pies': 'Tratamiento hidratante que deja los pies suaves y renovados.',
  'Pedicure clásico': 'Cuidado de uñas y cutículas de los pies con esmaltado tradicional.',
  'Pedicure medicinal': 'Atención especializada de durezas, callosidades y uñas para pies sanos.',
  'Tratamiento de callosidades': 'Eliminación de callosidades y durezas para pies suaves y cómodos.',

  // ── Piercer ──
  'Cambio de joyería': 'Cambio seguro de tu joyería por una nueva pieza, con higiene profesional.',
  'Piercing de cartílago': 'Perforación en el cartílago de la oreja con técnica estéril y joyería adecuada.',
  'Piercing de ceja': 'Perforación de ceja realizada con material estéril y asesoría de cuidados.',
  'Piercing de labio': 'Perforación de labio con técnica higiénica y joyería de calidad.',
  'Piercing de lengua': 'Perforación de lengua con protocolo estéril y recomendaciones de cuidado.',
  'Piercing de nariz': 'Perforación de nariz con técnica estéril y la joyería que elijas.',
  'Piercing de ombligo': 'Perforación de ombligo con material estéril y asesoría de cicatrización.',
  'Piercing de oreja (lóbulo)': 'Perforación del lóbulo con técnica higiénica y joyería adecuada.',
  'Piercing industrial': 'Doble perforación unida por una barra recta en el cartílago superior de la oreja.',

  // ── Tatuador/a ──
  'Acuarela': 'Tatuaje estilo acuarela con colores difuminados que imitan una pintura.',
  'Asesoría de diseño': 'Sesión para definir idea, estilo, tamaño y ubicación de tu tatuaje.',
  'Blackwork': 'Tatuaje en tinta negra sólida con diseños gráficos de alto contraste.',
  'Cover-up (tapado de tatuajes)': 'Diseño que cubre o transforma un tatuaje anterior en uno nuevo.',
  'Diseño de tatuaje personalizado': 'Creación de un diseño único hecho a tu medida antes de tatuar.',
  'Micro tatuajes': 'Tatuajes pequeños y delicados con líneas finas y detalle preciso.',
  'Neotradicional': 'Estilo de líneas marcadas y colores vivos con un toque moderno del tradicional.',
  'Realismo': 'Tatuaje realista que reproduce retratos u objetos con gran detalle y profundidad.',
  'Retoque de tatuajes': 'Retoque que reaviva el color y las líneas de un tatuaje existente.',
  'Tatuaje flash': 'Diseños prediseñados listos para tatuar de forma rápida.',
  'Tatuaje personalizado': 'Tatuaje creado a partir de tu idea, con diseño único y a medida.',
  'Tradicional': 'Estilo old school de líneas gruesas, colores sólidos e íconos clásicos.',

  // ── Terapeuta ──
  'Aromaterapia terapéutica': 'Terapia con aceites esenciales para relajar, equilibrar y mejorar el bienestar.',
  'Reflexología podal': 'Presión en puntos de los pies para estimular el equilibrio y la relajación del cuerpo.',
  'Reiki': 'Terapia energética que busca armonizar cuerpo y mente para una sensación de calma.',
  'Terapia con ventosas': 'Aplicación de ventosas que estimula la circulación y libera tensión muscular.',
  'Terapia craneal': 'Técnica suave en cabeza y cuello que alivia tensión y favorece la relajación.',
  'Terapia de puntos gatillo': 'Presión sobre nudos musculares para aliviar dolor y tensión localizada.',
  'Terapia de relajación': 'Sesión enfocada en reducir el estrés y relajar cuerpo y mente.',
  'Terapia descontracturante': 'Terapia que libera contracturas y tensiones para aliviar el dolor muscular.',
};

async function main() {
  console.log('📝 Rellenando descripciones por defecto del catálogo de servicios\n');
  let rowsUpdated = 0;
  let namesApplied = 0;
  for (const [name, description] of Object.entries(DESCRIPTIONS)) {
    // updateMany por nombre: cubre el servicio en todas sus categorías.
    const res = await prisma.serviceCatalog.updateMany({
      where: { name },
      data: { description },
    });
    if (res.count > 0) namesApplied++;
    rowsUpdated += res.count;
  }
  const total = await prisma.serviceCatalog.count();
  const withDesc = await prisma.serviceCatalog.count({ where: { NOT: { description: null } } });
  console.log(`✓ Nombres del mapa: ${Object.keys(DESCRIPTIONS).length} (${namesApplied} encontrados en el catálogo)`);
  console.log(`✓ Filas actualizadas: ${rowsUpdated}`);
  console.log(`✓ Catálogo: ${withDesc}/${total} servicios con descripción`);
}

main()
  .catch((e) => {
    console.error('✗ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
