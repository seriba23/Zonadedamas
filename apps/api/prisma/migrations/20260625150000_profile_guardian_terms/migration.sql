-- Registro de aceptación del aviso/términos para perfiles de menores por el tutor.
-- Aditiva: solo agrega una columna nullable.
ALTER TABLE `profiles` ADD COLUMN `guardian_terms_accepted_at` DATETIME(3) NULL;
