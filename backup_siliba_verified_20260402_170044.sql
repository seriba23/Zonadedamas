-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: siliba
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('04aac3b0-6970-447a-8138-a8affc16e256','376036c47024df264cb7b6bbaa075420c109b3510428c60a2f8a69907fcd28a5','2026-04-02 22:38:59.729','20260302032546_add_service_points_and_tenant_gallery',NULL,NULL,'2026-04-02 22:38:59.725',1),('152ab411-490a-4827-9fad-5274c7645d55','65a0860f370c3eec353b21543f2275f78e676cf9277b7c48e219226d6fee787e','2026-04-02 22:38:59.934','20260321062842_add_stripe_fields',NULL,NULL,'2026-04-02 22:38:59.915',1),('1e5c528d-443a-43b5-8bbf-282c2edbc801','b4bcaf34d606b9ccaf3490b8e00cae59c7700d55c0ff8ac22edafd87ac88a001','2026-04-02 22:38:59.915','20260312200000_add_social_login',NULL,NULL,'2026-04-02 22:38:59.897',1),('34a0be69-0636-4370-9baf-c6693e455d6c','c4c0be7f75896aed561eb5dd404a0a5272c9ad1e59443533e3c255b56d9fffc8','2026-04-02 22:39:00.266','20260402210049_add_professions_catalog',NULL,NULL,'2026-04-02 22:39:00.256',1),('4a574aa4-4a02-4e62-9386-ee795ca07a75','d14e763abbe2429b1c7d4eca1f11e1f05d376b9e74a70dfb86356ceafe4e0ea7','2026-04-02 22:39:00.255','20260402203437_add_professional_favorites',NULL,NULL,'2026-04-02 22:39:00.209',1),('53a391a4-cc7c-423a-be21-a771270e66f7','3e9e5988f48811a9a4ab1b748782d99f1744a6e6ff5869a000c2c501a81930e9','2026-04-02 22:38:59.732','20260302034837_add_service_subcategory',NULL,NULL,'2026-04-02 22:38:59.729',1),('655bd769-02a6-4930-9a0c-c36e1a5740d4','dea9f3792ebae8a24033ae10259135fb68a98cd420d5304a0b17a5f5bb35994d','2026-04-02 22:38:59.626','20260301061333_add_client_portal',NULL,NULL,'2026-04-02 22:38:59.537',1),('660330f5-21e3-43dc-ad9e-b5aa5855ca9a','c795b023c7edcb0cc9b5aed9e01f5c4c0911a8a8cbe690a383887a4cb21546fc','2026-04-02 22:38:59.094','20260221071133_add_business_hours',NULL,NULL,'2026-04-02 22:38:59.064',1),('68f90dde-5dbf-4f00-8228-071c995cfa24','7c3717ac6219e3cdbace4a8d171540faefa1ded14aea3a66b83a0cb6fe4312c6','2026-04-02 22:38:59.243','20260222224238_add_portfolio_reviews',NULL,NULL,'2026-04-02 22:38:59.134',1),('70d5fbba-5bff-4240-9643-14ca6e8d804e','d7273cdb19ba20f4bde489337dbab2e2765a3e1aa5551af166fe278a0908bd52','2026-04-02 22:39:00.204','20260401010241_add_invite_code_job_title_services',NULL,NULL,'2026-04-02 22:39:00.151',1),('714994c2-8784-4ac4-8c2b-198da56b0158','8e99469e847f6ad71292a4d8c2225dc152c3b7ccbb73aa000ba9ed2c144a8a95','2026-04-02 22:38:59.063','20260219045719_init',NULL,NULL,'2026-04-02 22:38:57.948',1),('7c5198af-7ff4-40dc-9bc1-f1ebcf8f665c','c8e5b6fe50751a54630b5b5d9456f2ccd309dc9248648294aee36db0d719d4af','2026-04-02 22:38:59.331','20260223054938_add_employee_commission',NULL,NULL,'2026-04-02 22:38:59.325',1),('85ba9c85-525c-4045-83f2-92e4f5508974','753466de38c27ca878a2b563a819330d8a208bba5c7c1a6b64b73a0208ebb1d4','2026-04-02 22:38:59.324','20260223025057_employee_invite_codes',NULL,NULL,'2026-04-02 22:38:59.299',1),('8d65570e-1c80-4eed-8a10-b138c8418cd2','5c5b138be558fbf3d94d4e4dd6bdf68997bcfe0832fcacc3bd8af36db199e708','2026-04-02 22:38:59.122','20260221093615_add_business_closures',NULL,NULL,'2026-04-02 22:38:59.095',1),('93fa7e70-0a9b-4a80-b932-769a3a7b0112','2a5ad953bed16369aabf3dd0f3ca6589b7aa751bf10e9a283d911f66a164b82d','2026-04-02 22:38:59.366','20260223201153_add_rescheduled_status',NULL,NULL,'2026-04-02 22:38:59.332',1),('96a2150f-1c29-4b64-b0b4-880f5f533e5b','cf42c5e6e61b9c45cddb62dfb1ac9d16ce6bc063289b7458e79d51f60377e9bb','2026-04-02 22:38:59.697','20260301193234_add_loyalty_points',NULL,NULL,'2026-04-02 22:38:59.690',1),('a5fce321-04ef-435a-8875-46a761236f5e','fd8f3ba7162f3c62ce7360e7a77bc28622e35450442a942901c485da2d80d390','2026-04-02 22:38:59.690','20260301184048_add_marketplace',NULL,NULL,'2026-04-02 22:38:59.627',1),('a6a91fe0-54ab-48f6-b4e8-8f10b912aad9','3a661c79db6ecb9c6eb6d16e9922e2f5057666d4c14da53e9efedbb8c48ce8dd','2026-04-02 22:38:59.298','20260223003018_employee_personal_info_training',NULL,NULL,'2026-04-02 22:38:59.243',1),('aba631b2-d6a0-4bc3-8f18-fc691d224caa','ccf4138855ecc09812ddeee205420fab69617d8085fec165f9555164eae23375','2026-04-02 22:39:00.130','20260330202213_subscription_licenses_annual',NULL,NULL,'2026-04-02 22:39:00.127',1),('aee3567e-884c-440f-a84e-62d629b374c7','d335793841c4460f8202c90f950f07aa063b9829449eec276d764fff4a13139b','2026-04-02 22:39:00.150','20260331195237_add_trial_subscription_status',NULL,NULL,'2026-04-02 22:39:00.131',1),('b2929e55-5910-4b09-9e0b-d49925abf14b','59e1f4cdbd9812a346609149b8d6fbff4ccb95ba4520ab464fff67a9a4b7f0c3','2026-04-02 22:38:59.725','20260302013839_add_tenant_gallery',NULL,NULL,'2026-04-02 22:38:59.698',1),('b8f37abf-9584-41ab-9297-11e0d96fdb02','744e5f3bdaadaef07e08edcbb60c93008b9d6a9cf2f570bfcd4331a006bebc5b','2026-04-02 22:39:00.113','20260330023939_add_card_color_to_tenant',NULL,NULL,'2026-04-02 22:39:00.109',1),('be18b27a-555f-4f72-baf3-c99245e34c43','29721e7983a38d293020cf56b8d9a20430756c6141325934bcdc82f3d92abcf6','2026-04-02 22:38:59.888','20260305042412_add_marketplace_favorites',NULL,NULL,'2026-04-02 22:38:59.842',1),('bfd355e8-055f-4c62-ad37-4fa7b1db45af','85718b5364a27dcaec4cd3a1b60122a35c910db17bf46a87dde9c91af8fc82b7','2026-04-02 22:39:00.208','20260401041048_add_employee_cover_image',NULL,NULL,'2026-04-02 22:39:00.205',1),('cd8141da-3c20-4fed-bf4f-d95ccfbd8c00','9738390c4c48872de03db1fc7049b82ee4574fc61af199b7e9b2f6e605fe6921','2026-04-02 22:38:59.893','20260311040133_add_marketplace_user_settings',NULL,NULL,'2026-04-02 22:38:59.889',1),('cfc9194b-3faf-4eb8-ae4d-1f7910fcaf20','b13a8ec88b2cd2bfb42e95f31a6134c512479964de738df5b0af2ea513fd34b4','2026-04-02 22:38:59.841','20260303040732_add_rewards_system',NULL,NULL,'2026-04-02 22:38:59.733',1),('d135f72e-3f81-4dd9-8e1e-9d9d6468f627','ecce8c049590a8d4993590411f0168fb6c781d1c1e62dea9b5e2595e93397fd1','2026-04-02 22:38:59.134','20260222212309_add_token_hint',NULL,NULL,'2026-04-02 22:38:59.123',1),('d51b3cd9-d0e6-425f-b38c-16816b3caaf5','94fa37880087c03fc203693f7f6f42254bed557f30c1410b8ac5934de6f79ccc','2026-04-02 22:38:59.486','20260226034227_subscriptions_platform',NULL,NULL,'2026-04-02 22:38:59.367',1),('e51910cc-ef19-4fd3-8543-1f477da94692','03202392afaed214f0335255684596e4d2edcb20105809d4c4ff0c951e94ca79','2026-04-02 22:38:59.536','20260228061100_add_notification_logs',NULL,NULL,'2026-04-02 22:38:59.486',1),('f5265e9d-9677-468e-a052-218aa6e7b79c','c5a6a6d032c8ccf56e57b6daaaeec353645813a025a88903b3c698c2edd579fb','2026-04-02 22:39:00.126','20260330045343_billing_v2_reviews_dual_photo_consent',NULL,NULL,'2026-04-02 22:39:00.114',1),('f62ff6f4-c5f2-4b5d-82dc-69a203b85949','55a4a71dd9e8c0b7ce6001352a089f975f9ed5133a7e9650fc283a33af0c1443','2026-04-02 22:39:00.108','20260326035616_add_inventory_promotions_bundles_timeoff',NULL,NULL,'2026-04-02 22:38:59.935',1),('f63f0eb4-9e0a-46b7-a3b1-3b972df95c79','f3eb2a05aad5a854f1e80a0791d944864d443b82eb8404d09ef464a474c4f518','2026-04-02 22:39:42.439','20260402223942_service_catalog_composite_unique',NULL,NULL,'2026-04-02 22:39:42.430',1),('f6772c29-e27e-4295-97c4-0a34658e3f7b','defef1740d95bdcbf5e9b077119703e5d5989d3ba205afd6320922181897e345','2026-04-02 22:39:00.277','20260402213122_add_service_catalog',NULL,NULL,'2026-04-02 22:39:00.266',1),('fc3a30bb-9e31-41da-9c63-8d534bd836f6','c740754b916bc16e1c5b0f514288f386d8efd024685190b61dd03b88efb699b0','2026-04-02 22:38:59.896','20260311050000_add_suspend_and_notif_messages',NULL,NULL,'2026-04-02 22:38:59.893',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointment_items`
--

DROP TABLE IF EXISTS `appointment_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_items` (
  `id` varchar(191) NOT NULL,
  `appointment_id` varchar(191) NOT NULL,
  `service_id` varchar(191) NOT NULL,
  `employee_id` varchar(191) NOT NULL,
  `resource_id` varchar(191) DEFAULT NULL,
  `start_time` datetime(3) NOT NULL,
  `end_time` datetime(3) NOT NULL,
  `price_snapshot` decimal(10,2) NOT NULL,
  `commission_snapshot` decimal(10,2) DEFAULT NULL,
  `duration_snapshot` int(11) NOT NULL,
  `service_name_snapshot` varchar(191) NOT NULL,
  `notes` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `appointment_items_appointment_id_idx` (`appointment_id`),
  KEY `appointment_items_employee_id_start_time_end_time_idx` (`employee_id`,`start_time`,`end_time`),
  KEY `appointment_items_service_id_fkey` (`service_id`),
  KEY `appointment_items_resource_id_fkey` (`resource_id`),
  CONSTRAINT `appointment_items_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointment_items_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointment_items_resource_id_fkey` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `appointment_items_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointment_items`
--

LOCK TABLES `appointment_items` WRITE;
/*!40000 ALTER TABLE `appointment_items` DISABLE KEYS */;
INSERT INTO `appointment_items` VALUES ('0d8c1a91-ef11-4809-a253-439f1d962168','3efc1263-fcfc-4017-85a7-b629ecc12c13','094d585d-29ed-489a-8230-23d5c9c50cf5','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-11 09:30:00.000','2026-03-11 10:00:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('0d9ed08a-51b3-4160-9856-851bc7e30028','a357da6d-6688-4c6e-a6fa-4d518c887a9b','0b240314-0a21-4c06-a74b-6a98a7f966b5','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-12 09:00:00.000','2026-03-12 10:00:00.000',50.00,25.00,60,'Facial Profundo',NULL),('16a4bc4f-0caa-482f-8099-8e378ec122a3','4a42a131-eb87-41e7-aa6a-6a7143f34fd1','094d585d-29ed-489a-8230-23d5c9c50cf5','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-06 11:00:00.000','2026-03-06 11:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('1a8a3b81-7371-4b24-83c7-a2979c67be90','14b866ed-66fa-4bcd-81a9-f39950ac9e59','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-27 16:00:00.000','2026-03-27 17:30:00.000',80.00,40.00,90,'Tinte Completo',NULL),('25cdedb2-5b43-40a7-84dd-aa25ccf25e8b','07d944a1-3342-439b-8f36-c2234485566c','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-11 14:00:00.000','2026-03-11 15:30:00.000',80.00,40.00,90,'Tinte Completo',NULL),('370ae2df-9068-4615-8057-357fca79c218','72f1bd66-70dd-4287-87b0-5c6356b16066','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-20 15:00:00.000','2026-03-20 16:30:00.000',80.00,40.00,90,'Tinte Completo',NULL),('486ece1c-0dfe-4cd6-a52a-979c487ef62b','a04f492c-2682-4c3c-905d-1fd5acf8773f','fe0ec01d-c98f-4338-99c5-529ccb656627','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-16 13:00:00.000','2026-03-16 13:30:00.000',20.00,12.00,30,'Manicure Clásico',NULL),('5ebcf68f-19de-4b27-80f7-ace1eef74634','cca637f3-6206-4f2d-83fd-f6c1b5b61c2b','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-04 10:30:00.000','2026-03-04 12:00:00.000',80.00,40.00,90,'Tinte Completo',NULL),('5fbfa5db-fbc9-470a-865c-80be8e7dc8c7','70e1c1f9-2536-4a87-b6e8-eb27cc29c405','0b240314-0a21-4c06-a74b-6a98a7f966b5','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-03 09:00:00.000','2026-03-03 10:00:00.000',50.00,25.00,60,'Facial Profundo',NULL),('645395c7-81df-42b1-a349-5cab5217e9c8','250ae67c-9b3b-4977-b6ff-8b1344f051a8','fe0ec01d-c98f-4338-99c5-529ccb656627','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-05 11:00:00.000','2026-03-05 11:30:00.000',20.00,12.00,30,'Manicure Clásico',NULL),('675141aa-f592-468d-b54c-e5333a1f823a','2a4fcb33-a1bf-4f6d-824c-4e55c15b6ce8','f2ae6230-1d04-47f2-ba46-f116707e8e30','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-06 09:30:00.000','2026-03-06 10:15:00.000',35.00,20.00,45,'Peinado y Brushing',NULL),('68ef960b-08ab-4785-9af9-c42567bbc670','6f4f46c5-54f2-4208-a12b-bc0e5028a5ff','094d585d-29ed-489a-8230-23d5c9c50cf5','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-24 13:00:00.000','2026-03-24 13:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('763b27db-14f5-4daf-ae58-490c10b17012','271fa2fd-e453-40ff-8b19-ceb5038b2d3c','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-22 14:30:00.000','2026-03-22 16:00:00.000',80.00,40.00,90,'Tinte Completo',NULL),('790fd808-ac79-436b-82d9-da11f438de38','50876634-b8dd-4652-81a6-b632cb370305','fe0ec01d-c98f-4338-99c5-529ccb656627','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-10 10:00:00.000','2026-03-10 10:30:00.000',20.00,12.00,30,'Manicure Clásico',NULL),('7ef8727f-d98e-481e-ac1e-072f132cb076','e05a0017-b0d5-4ad1-a8a5-94538b52e6b4','0b240314-0a21-4c06-a74b-6a98a7f966b5','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-25 11:00:00.000','2026-03-25 12:00:00.000',50.00,25.00,60,'Facial Profundo',NULL),('8039aa6d-d3d1-451d-8b44-80116964a8fb','959d189e-6a8f-497f-8903-6ab962f0d08f','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-04 13:00:00.000','2026-03-04 14:30:00.000',80.00,40.00,90,'Tinte Completo',NULL),('8ffa7447-d375-4e4c-b4fb-e2d8ee16e42b','68e8b85d-ec18-472b-862f-a30d35a4c69c','094d585d-29ed-489a-8230-23d5c9c50cf5','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-01 10:00:00.000','2026-03-01 10:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('94ed4930-f92e-4293-b23a-80879a8d8d13','b262460c-72f2-41eb-9aa8-55bcd9b9a425','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-20 11:30:00.000','2026-03-20 13:00:00.000',80.00,40.00,90,'Tinte Completo',NULL),('9ccc49c4-ae1e-4fe9-8a35-7fe3b79fc719','2f5b3fee-6bc1-47f6-8f7c-a9f756babdac','fe0ec01d-c98f-4338-99c5-529ccb656627','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-28 09:30:00.000','2026-03-28 10:00:00.000',20.00,12.00,30,'Manicure Clásico',NULL),('9de0bf94-3843-48a0-a2e7-3930f7f38901','a76dffbb-7e51-4437-802b-698cac8615fa','094d585d-29ed-489a-8230-23d5c9c50cf5','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-17 10:00:00.000','2026-03-17 10:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('9fa2212b-d3b0-407c-be0d-1409caf644d9','9ce63b3d-d350-45e9-bd1d-bc9ffa07de1e','0b240314-0a21-4c06-a74b-6a98a7f966b5','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-07 14:30:00.000','2026-03-07 15:30:00.000',50.00,25.00,60,'Facial Profundo',NULL),('a1a6f87a-9c5c-410d-a866-105940994609','a2825bb3-62bb-4a4b-b31e-f625ff8865bb','094d585d-29ed-489a-8230-23d5c9c50cf5','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-02 09:00:00.000','2026-03-02 09:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('a84e131f-0380-4105-9491-6d8a4186c095','4283dcf7-860b-47f0-b0dc-2ea5a5305b2d','094d585d-29ed-489a-8230-23d5c9c50cf5','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-26 11:00:00.000','2026-03-26 11:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('adb24f95-ba43-4f89-b561-6a53f1ab5773','21dafda3-bccd-4f8c-9312-40aa553c54dd','094d585d-29ed-489a-8230-23d5c9c50cf5','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-18 09:00:00.000','2026-03-18 09:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('b0155fd4-00a5-4976-a3f3-1a740fccdb46','8a1fcdec-ac7d-4fc5-a41b-c2b0a653c442','094d585d-29ed-489a-8230-23d5c9c50cf5','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-05 11:30:00.000','2026-03-05 12:00:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('b06e2560-4614-4035-941f-0840fbe1749f','e69b5abd-7f3c-49ff-a6ef-14d1a263e685','fe0ec01d-c98f-4338-99c5-529ccb656627','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-21 10:30:00.000','2026-03-21 11:00:00.000',20.00,12.00,30,'Manicure Clásico',NULL),('c5655fcf-7af5-476f-bf46-2e9ca25ef8d6','8cd3fdcb-dce7-4e1f-8193-418d4991545b','094d585d-29ed-489a-8230-23d5c9c50cf5','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-09 11:00:00.000','2026-03-09 11:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('c8d8e2fb-b893-49f5-9cd4-4010b0a5a5c9','2842dce9-ce9d-4b03-a129-12f9d4496df1','094d585d-29ed-489a-8230-23d5c9c50cf5','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-02 10:00:00.000','2026-03-02 10:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('cf2dd9f3-8d2a-43d5-ab2d-78d9d6aee965','3162b083-3963-42b0-954d-92df3d0471e2','0b240314-0a21-4c06-a74b-6a98a7f966b5','7b2b44ff-061b-4074-ae2c-fb1a341e942c',NULL,'2026-03-18 15:30:00.000','2026-03-18 16:30:00.000',50.00,25.00,60,'Facial Profundo',NULL),('d16c4dd4-c6ee-459e-a696-01353a51cb2d','7dc79409-df1e-41b2-8a3b-f2260a2e2124','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-09 14:00:00.000','2026-03-09 15:30:00.000',80.00,40.00,90,'Tinte Completo',NULL),('d836f995-fe7b-4db8-9ff3-664cca190124','d39153c7-0858-40c4-ba46-b0b904c14cb0','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-08 09:00:00.000','2026-03-08 10:30:00.000',80.00,40.00,90,'Tinte Completo',NULL),('dd4423c5-fd56-4fdd-9d6c-71376269827c','949c3f76-b8dd-459d-9842-4f47deea1286','094d585d-29ed-489a-8230-23d5c9c50cf5','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-15 10:00:00.000','2026-03-15 10:30:00.000',25.00,15.00,30,'Corte de Cabello',NULL),('dda95bad-fc42-44c3-9dd4-4b178684993c','66ecaa9d-4270-49bf-99f5-24d4b328d072','f2ae6230-1d04-47f2-ba46-f116707e8e30','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-14 10:30:00.000','2026-03-14 11:15:00.000',35.00,20.00,45,'Peinado y Brushing',NULL),('e2b701cd-b23a-41e6-86f0-ead2555ffce0','e457a5d9-324c-42ec-ba86-7af443ae501c','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-03 14:00:00.000','2026-03-03 15:30:00.000',80.00,40.00,90,'Tinte Completo',NULL),('f5e5b12c-967f-48f0-916e-f67c301a2ddc','78c8498a-75af-45e6-a5ca-6e3ba5e78532','12a84508-ff1d-4f4d-a88d-f8cef7a369e4','0f274d2c-1a87-4cb0-ba07-ddea21590435',NULL,'2026-03-13 15:00:00.000','2026-03-13 16:30:00.000',80.00,40.00,90,'Tinte Completo',NULL),('ff04cc31-7f56-4ad5-9b73-358575548851','2cd1e2f0-729e-40bc-adcb-87f61b39895f','f2ae6230-1d04-47f2-ba46-f116707e8e30','8e1a6790-9765-458f-9630-c21b478fd7e1',NULL,'2026-03-23 13:30:00.000','2026-03-23 14:15:00.000',35.00,20.00,45,'Peinado y Brushing',NULL);
/*!40000 ALTER TABLE `appointment_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointment_photos`
--

DROP TABLE IF EXISTS `appointment_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_photos` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `appointment_id` varchar(191) NOT NULL,
  `image_url` varchar(191) NOT NULL,
  `caption` varchar(255) DEFAULT NULL,
  `uploaded_by_id` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `appointment_photos_tenant_id_appointment_id_idx` (`tenant_id`,`appointment_id`),
  KEY `appointment_photos_appointment_id_fkey` (`appointment_id`),
  KEY `appointment_photos_uploaded_by_id_fkey` (`uploaded_by_id`),
  CONSTRAINT `appointment_photos_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointment_photos_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointment_photos_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointment_photos`
--

LOCK TABLES `appointment_photos` WRITE;
/*!40000 ALTER TABLE `appointment_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `appointment_photos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointment_status_history`
--

DROP TABLE IF EXISTS `appointment_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_status_history` (
  `id` varchar(191) NOT NULL,
  `appointment_id` varchar(191) NOT NULL,
  `from_status` enum('PENDING','CONFIRMED','RESCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW') DEFAULT NULL,
  `to_status` enum('PENDING','CONFIRMED','RESCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW') NOT NULL,
  `changed_by` varchar(191) DEFAULT NULL,
  `notes` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `appointment_status_history_appointment_id_idx` (`appointment_id`),
  CONSTRAINT `appointment_status_history_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointment_status_history`
--

LOCK TABLES `appointment_status_history` WRITE;
/*!40000 ALTER TABLE `appointment_status_history` DISABLE KEYS */;
INSERT INTO `appointment_status_history` VALUES ('08fbd574-029b-43ee-a9ff-72d7810d50fe','78c8498a-75af-45e6-a5ca-6e3ba5e78532',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.888'),('0b095039-ed69-4492-abaf-14d63017d2c8','72f1bd66-70dd-4287-87b0-5c6356b16066',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.956'),('19a53815-5ee7-4966-9324-e28ef78cf333','2cd1e2f0-729e-40bc-adcb-87f61b39895f',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.959'),('242dd252-0d28-47be-a02f-05185d6de066','8a1fcdec-ac7d-4fc5-a41b-c2b0a653c442',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:29.578'),('24e6b4f7-7020-4b5d-9ef3-138da87562e3','2a4fcb33-a1bf-4f6d-824c-4e55c15b6ce8',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.939'),('301db166-6c4e-4c72-8cb4-4630f6c5867c','6f4f46c5-54f2-4208-a12b-bc0e5028a5ff',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.896'),('3171a7a9-8550-4090-821b-9133bb12c9b7','14b866ed-66fa-4bcd-81a9-f39950ac9e59',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.899'),('31d0066a-cf52-418f-bbef-d69acf95fbee','21dafda3-bccd-4f8c-9312-40aa553c54dd',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.953'),('34761025-bdfd-41fa-8a99-8d5439ee7806','e457a5d9-324c-42ec-ba86-7af443ae501c',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:29.575'),('38446338-7dfe-496e-a5fa-8a6225c3fa4e','250ae67c-9b3b-4977-b6ff-8b1344f051a8',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.905'),('3a4aadf1-cf42-4edd-a605-de60d2221961','68e8b85d-ec18-472b-862f-a30d35a4c69c',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:29.572'),('3f42762a-921f-41aa-81e9-3de1301fcbe5','271fa2fd-e453-40ff-8b19-ceb5038b2d3c',NULL,'PENDING','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:29.588'),('455e318a-2a7d-4d84-8f0f-ee1dcb41bfbd','8cd3fdcb-dce7-4e1f-8193-418d4991545b',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.943'),('49c908bd-b444-4acf-8da7-45699de04038','4283dcf7-860b-47f0-b0dc-2ea5a5305b2d',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.962'),('501ad0a2-37e9-44cd-aba9-fdc0215b3080','3162b083-3963-42b0-954d-92df3d0471e2',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.921'),('515874c3-df32-447a-b85f-407e82aa8918','e69b5abd-7f3c-49ff-a6ef-14d1a263e685',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.924'),('53d7d090-0344-4359-97fe-72ea668509aa','a2825bb3-62bb-4a4b-b31e-f625ff8865bb',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.870'),('548ad1c8-f5bc-4455-a653-129770d7f898','50876634-b8dd-4652-81a6-b632cb370305',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.911'),('555686fb-5abd-4e75-8369-4fe6f36bb7d7','e05a0017-b0d5-4ad1-a8a5-94538b52e6b4',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.927'),('57674a5e-cd18-4c5c-b224-a4062e92f605','a04f492c-2682-4c3c-905d-1fd5acf8773f',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.918'),('603fc429-a33a-4b5c-9923-47e3af871bc1','a357da6d-6688-4c6e-a6fa-4d518c887a9b',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.915'),('7fc0629b-81d7-4689-a59f-bca3aaaf99b5','959d189e-6a8f-497f-8903-6ab962f0d08f',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.936'),('8cd02a08-4462-4064-982f-17f85c9d1904','66ecaa9d-4270-49bf-99f5-24d4b328d072',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.950'),('96126a93-cada-405d-83a7-feddbc93ff40','7dc79409-df1e-41b2-8a3b-f2260a2e2124',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.882'),('a021f14f-7335-4586-b98a-8027c40f5fd6','d39153c7-0858-40c4-ba46-b0b904c14cb0',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:29.581'),('aa8b2bfb-991b-4103-b827-cf582eba4d80','cca637f3-6206-4f2d-83fd-f6c1b5b61c2b',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.876'),('abfd03c1-229e-4e63-a058-1ade0f1171d3','3efc1263-fcfc-4017-85a7-b629ecc12c13',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.885'),('b3374757-ab2f-4b11-8267-30de8415f796','07d944a1-3342-439b-8f36-c2234485566c',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.946'),('b7b49169-4778-46c4-ac6f-79a9e941e4bf','9ce63b3d-d350-45e9-bd1d-bc9ffa07de1e',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.908'),('d7be652d-af91-47c3-8242-aebeda0ef596','a76dffbb-7e51-4437-802b-698cac8615fa',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.890'),('dc363482-163e-4df6-803d-986ed3b7e87c','949c3f76-b8dd-459d-9842-4f47deea1286',NULL,'CONFIRMED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:29.584'),('e38f89f0-fe9c-494e-bd31-610287bbede3','2842dce9-ce9d-4b03-a129-12f9d4496df1',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.933'),('e4580e98-ec6e-48dd-a0cb-42497cb5e8f4','2f5b3fee-6bc1-47f6-8f7c-a9f756babdac',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.930'),('edcb619b-10da-4e00-baee-784130db1653','70e1c1f9-2536-4a87-b6e8-eb27cc29c405',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.902'),('f6bde000-0d8c-4ccf-a26b-88551f714f8d','4a42a131-eb87-41e7-aa6a-6a7143f34fd1',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.878'),('fdef72bb-3852-4f96-9a61-c20157baddd3','b262460c-72f2-41eb-9aa8-55bcd9b9a425',NULL,'COMPLETED','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','Creada por seed','2026-04-02 22:54:28.893');
/*!40000 ALTER TABLE `appointment_status_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointments` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `location_id` varchar(191) NOT NULL,
  `client_id` varchar(191) NOT NULL,
  `employee_id` varchar(191) NOT NULL,
  `status` enum('PENDING','CONFIRMED','RESCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'PENDING',
  `start_time` datetime(3) NOT NULL,
  `end_time` datetime(3) NOT NULL,
  `notes` text DEFAULT NULL,
  `internal_notes` text DEFAULT NULL,
  `cancellation_reason` text DEFAULT NULL,
  `cancelled_by` varchar(191) DEFAULT NULL,
  `source` enum('ONLINE','WALK_IN','PHONE','MANUAL') NOT NULL DEFAULT 'MANUAL',
  `created_by` varchar(191) DEFAULT NULL,
  `photo_consent` tinyint(1) DEFAULT NULL,
  `photo_consent_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `appointments_tenant_id_location_id_start_time_idx` (`tenant_id`,`location_id`,`start_time`),
  KEY `appointments_employee_id_start_time_end_time_idx` (`employee_id`,`start_time`,`end_time`),
  KEY `appointments_client_id_idx` (`client_id`),
  KEY `appointments_status_idx` (`status`),
  KEY `appointments_location_id_fkey` (`location_id`),
  CONSTRAINT `appointments_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointments_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointments_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
INSERT INTO `appointments` VALUES ('07d944a1-3342-439b-8f36-c2234485566c','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','519f8853-d126-4066-ad04-ff2cedd8315c','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-11 14:00:00.000','2026-03-11 15:30:00.000',NULL,NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.944','2026-04-02 22:54:28.944'),('14b866ed-66fa-4bcd-81a9-f39950ac9e59','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','deab6e4b-4a5f-48d0-9bc6-1c1316a0ddad','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-27 16:00:00.000','2026-03-27 17:30:00.000','Viene con acompañante',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.897','2026-04-02 22:54:28.897'),('21dafda3-bccd-4f8c-9312-40aa553c54dd','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','a7f4a2af-5a59-4b0f-a0e0-63abe0ff99d3','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-18 09:00:00.000','2026-03-18 09:30:00.000','Prefiere productos orgánicos',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.950','2026-04-02 22:54:28.950'),('250ae67c-9b3b-4977-b6ff-8b1344f051a8','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','2cba81f6-0d69-4030-926e-f5dcdf54ed23','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-05 11:00:00.000','2026-03-05 11:30:00.000','Primera visita',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.903','2026-04-02 22:54:28.903'),('271fa2fd-e453-40ff-8b19-ceb5038b2d3c','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','1357cdf7-082e-4ab3-be55-f6ba689151eb','0f274d2c-1a87-4cb0-ba07-ddea21590435','PENDING','2026-03-22 14:30:00.000','2026-03-22 16:00:00.000',NULL,NULL,NULL,NULL,'ONLINE','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:29.585','2026-04-02 22:54:29.585'),('2842dce9-ce9d-4b03-a129-12f9d4496df1','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','210935bc-8532-49d8-8493-501047851385','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-02 10:00:00.000','2026-03-02 10:30:00.000','Cliente habitual',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.931','2026-04-02 22:54:28.931'),('2a4fcb33-a1bf-4f6d-824c-4e55c15b6ce8','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','40f5033e-50f9-43af-a1ef-78183dd83604','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-06 09:30:00.000','2026-03-06 10:15:00.000','Pidió turno temprano',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.937','2026-04-02 22:54:28.937'),('2cd1e2f0-729e-40bc-adcb-87f61b39895f','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','cc6c876f-ed4b-4584-846c-7724e82c18f7','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-23 13:30:00.000','2026-03-23 14:15:00.000','Tiene prisa, puntualidad importante',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.957','2026-04-02 22:54:28.957'),('2f5b3fee-6bc1-47f6-8f7c-a9f756babdac','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','deab6e4b-4a5f-48d0-9bc6-1c1316a0ddad','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-28 09:30:00.000','2026-03-28 10:00:00.000','Viene con acompañante',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.928','2026-04-02 22:54:28.928'),('3162b083-3963-42b0-954d-92df3d0471e2','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','a7f4a2af-5a59-4b0f-a0e0-63abe0ff99d3','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-18 15:30:00.000','2026-03-18 16:30:00.000','Prefiere productos orgánicos',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.919','2026-04-02 22:54:28.919'),('3efc1263-fcfc-4017-85a7-b629ecc12c13','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','519f8853-d126-4066-ad04-ff2cedd8315c','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-11 09:30:00.000','2026-03-11 10:00:00.000',NULL,NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.883','2026-04-02 22:54:28.883'),('4283dcf7-860b-47f0-b0dc-2ea5a5305b2d','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','deab6e4b-4a5f-48d0-9bc6-1c1316a0ddad','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-26 11:00:00.000','2026-03-26 11:30:00.000','Viene con acompañante',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.960','2026-04-02 22:54:28.960'),('4a42a131-eb87-41e7-aa6a-6a7143f34fd1','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','40f5033e-50f9-43af-a1ef-78183dd83604','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-06 11:00:00.000','2026-03-06 11:30:00.000','Pidió turno temprano',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.877','2026-04-02 22:54:28.877'),('50876634-b8dd-4652-81a6-b632cb370305','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','4d1dd1bd-ff28-4663-a84e-957daabb220d','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-10 10:00:00.000','2026-03-10 10:30:00.000','Referida por otra clienta',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.909','2026-04-02 22:54:28.909'),('66ecaa9d-4270-49bf-99f5-24d4b328d072','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','a1972e03-5cdb-4fdf-9b8b-826eaaa859bb','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-14 10:30:00.000','2026-03-14 11:15:00.000','Llamar para confirmar un día antes',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.947','2026-04-02 22:54:28.947'),('68e8b85d-ec18-472b-862f-a30d35a4c69c','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','1357cdf7-082e-4ab3-be55-f6ba689151eb','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-01 10:00:00.000','2026-03-01 10:30:00.000','Cliente frecuente',NULL,NULL,NULL,'ONLINE','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:29.569','2026-04-02 22:54:29.569'),('6f4f46c5-54f2-4208-a12b-bc0e5028a5ff','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','cc6c876f-ed4b-4584-846c-7724e82c18f7','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-24 13:00:00.000','2026-03-24 13:30:00.000','Tiene prisa, puntualidad importante',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.894','2026-04-02 22:54:28.894'),('70e1c1f9-2536-4a87-b6e8-eb27cc29c405','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','210935bc-8532-49d8-8493-501047851385','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-03 09:00:00.000','2026-03-03 10:00:00.000','Cliente habitual',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.900','2026-04-02 22:54:28.900'),('72f1bd66-70dd-4287-87b0-5c6356b16066','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','bca8124c-fe45-4a6d-99fb-8715cf094212','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-20 15:00:00.000','2026-03-20 16:30:00.000',NULL,NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.954','2026-04-02 22:54:28.954'),('78c8498a-75af-45e6-a5ca-6e3ba5e78532','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','a1972e03-5cdb-4fdf-9b8b-826eaaa859bb','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-13 15:00:00.000','2026-03-13 16:30:00.000','Llamar para confirmar un día antes',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.886','2026-04-02 22:54:28.886'),('7dc79409-df1e-41b2-8a3b-f2260a2e2124','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','4d1dd1bd-ff28-4663-a84e-957daabb220d','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-09 14:00:00.000','2026-03-09 15:30:00.000','Referida por otra clienta',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.879','2026-04-02 22:54:28.879'),('8a1fcdec-ac7d-4fc5-a41b-c2b0a653c442','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','1357cdf7-082e-4ab3-be55-f6ba689151eb','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-05 11:30:00.000','2026-03-05 12:00:00.000',NULL,NULL,NULL,NULL,'ONLINE','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:29.576','2026-04-02 22:54:29.576'),('8cd3fdcb-dce7-4e1f-8193-418d4991545b','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','4d1dd1bd-ff28-4663-a84e-957daabb220d','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-09 11:00:00.000','2026-03-09 11:30:00.000','Referida por otra clienta',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.940','2026-04-02 22:54:28.940'),('949c3f76-b8dd-459d-9842-4f47deea1286','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','1357cdf7-082e-4ab3-be55-f6ba689151eb','0f274d2c-1a87-4cb0-ba07-ddea21590435','CONFIRMED','2026-03-15 10:00:00.000','2026-03-15 10:30:00.000',NULL,NULL,NULL,NULL,'ONLINE','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:29.582','2026-04-02 22:54:29.582'),('959d189e-6a8f-497f-8903-6ab962f0d08f','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','2cba81f6-0d69-4030-926e-f5dcdf54ed23','8e1a6790-9765-458f-9630-c21b478fd7e1','COMPLETED','2026-03-04 13:00:00.000','2026-03-04 14:30:00.000','Primera visita',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.934','2026-04-02 22:54:28.934'),('9ce63b3d-d350-45e9-bd1d-bc9ffa07de1e','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','40f5033e-50f9-43af-a1ef-78183dd83604','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-07 14:30:00.000','2026-03-07 15:30:00.000','Pidió turno temprano',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.906','2026-04-02 22:54:28.906'),('a04f492c-2682-4c3c-905d-1fd5acf8773f','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','a1972e03-5cdb-4fdf-9b8b-826eaaa859bb','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-16 13:00:00.000','2026-03-16 13:30:00.000','Llamar para confirmar un día antes',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.916','2026-04-02 22:54:28.916'),('a2825bb3-62bb-4a4b-b31e-f625ff8865bb','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','210935bc-8532-49d8-8493-501047851385','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-02 09:00:00.000','2026-03-02 09:30:00.000','Cliente habitual',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.866','2026-04-02 22:54:28.866'),('a357da6d-6688-4c6e-a6fa-4d518c887a9b','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','519f8853-d126-4066-ad04-ff2cedd8315c','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-12 09:00:00.000','2026-03-12 10:00:00.000',NULL,NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.913','2026-04-02 22:54:28.913'),('a76dffbb-7e51-4437-802b-698cac8615fa','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','a7f4a2af-5a59-4b0f-a0e0-63abe0ff99d3','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-17 10:00:00.000','2026-03-17 10:30:00.000','Prefiere productos orgánicos',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.888','2026-04-02 22:54:28.888'),('b262460c-72f2-41eb-9aa8-55bcd9b9a425','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','bca8124c-fe45-4a6d-99fb-8715cf094212','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-20 11:30:00.000','2026-03-20 13:00:00.000',NULL,NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.891','2026-04-02 22:54:28.891'),('cca637f3-6206-4f2d-83fd-f6c1b5b61c2b','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','2cba81f6-0d69-4030-926e-f5dcdf54ed23','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-04 10:30:00.000','2026-03-04 12:00:00.000','Primera visita',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.872','2026-04-02 22:54:28.872'),('d39153c7-0858-40c4-ba46-b0b904c14cb0','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','1357cdf7-082e-4ab3-be55-f6ba689151eb','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-08 09:00:00.000','2026-03-08 10:30:00.000',NULL,NULL,NULL,NULL,'ONLINE','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:29.579','2026-04-02 22:54:29.579'),('e05a0017-b0d5-4ad1-a8a5-94538b52e6b4','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','cc6c876f-ed4b-4584-846c-7724e82c18f7','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-25 11:00:00.000','2026-03-25 12:00:00.000','Tiene prisa, puntualidad importante',NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.925','2026-04-02 22:54:28.925'),('e457a5d9-324c-42ec-ba86-7af443ae501c','ed2de3f5-d5b6-4f00-8549-c1078aba153a','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','1357cdf7-082e-4ab3-be55-f6ba689151eb','0f274d2c-1a87-4cb0-ba07-ddea21590435','COMPLETED','2026-03-03 14:00:00.000','2026-03-03 15:30:00.000',NULL,NULL,NULL,NULL,'ONLINE','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:29.573','2026-04-02 22:54:29.573'),('e69b5abd-7f3c-49ff-a6ef-14d1a263e685','ed2de3f5-d5b6-4f00-8549-c1078aba153a','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','bca8124c-fe45-4a6d-99fb-8715cf094212','7b2b44ff-061b-4074-ae2c-fb1a341e942c','COMPLETED','2026-03-21 10:30:00.000','2026-03-21 11:00:00.000',NULL,NULL,NULL,NULL,'MANUAL','3ca3cbcd-5744-48f1-8a6b-766c3654fb48',NULL,NULL,'2026-04-02 22:54:28.922','2026-04-02 22:54:28.922');
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_log` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `user_id` varchar(191) DEFAULT NULL,
  `action` varchar(191) NOT NULL,
  `entity_type` varchar(191) NOT NULL,
  `entity_id` varchar(191) NOT NULL,
  `before_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`before_data`)),
  `after_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`after_data`)),
  `ip_address` varchar(191) DEFAULT NULL,
  `user_agent` varchar(191) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `audit_log_tenant_id_created_at_idx` (`tenant_id`,`created_at`),
  KEY `audit_log_entity_type_entity_id_idx` (`entity_type`,`entity_id`),
  KEY `audit_log_user_id_idx` (`user_id`),
  CONSTRAINT `audit_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `audit_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `automation_rules`
--

DROP TABLE IF EXISTS `automation_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `automation_rules` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  `trigger_type` varchar(191) NOT NULL,
  `trigger_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`trigger_config`)),
  `condition_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`condition_config`)),
  `action_type` varchar(191) NOT NULL,
  `action_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`action_config`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `quiet_hours_start` varchar(191) DEFAULT NULL,
  `quiet_hours_end` varchar(191) DEFAULT NULL,
  `rate_limit_per_client` int(11) DEFAULT NULL,
  `rate_limit_window_hours` int(11) DEFAULT NULL,
  `last_triggered_at` datetime(3) DEFAULT NULL,
  `execution_count` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `automation_rules_tenant_id_idx` (`tenant_id`),
  KEY `automation_rules_tenant_id_is_active_idx` (`tenant_id`,`is_active`),
  CONSTRAINT `automation_rules_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `automation_rules`
--

LOCK TABLES `automation_rules` WRITE;
/*!40000 ALTER TABLE `automation_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `automation_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_closures`
--

DROP TABLE IF EXISTS `business_closures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `business_closures` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `business_closures_tenant_id_start_date_end_date_idx` (`tenant_id`,`start_date`,`end_date`),
  CONSTRAINT `business_closures_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_closures`
--

LOCK TABLES `business_closures` WRITE;
/*!40000 ALTER TABLE `business_closures` DISABLE KEYS */;
/*!40000 ALTER TABLE `business_closures` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_hours`
--

DROP TABLE IF EXISTS `business_hours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `business_hours` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `day_of_week` enum('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') NOT NULL,
  `open_time` varchar(191) NOT NULL,
  `close_time` varchar(191) NOT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `business_hours_tenant_id_day_of_week_key` (`tenant_id`,`day_of_week`),
  CONSTRAINT `business_hours_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_hours`
--

LOCK TABLES `business_hours` WRITE;
/*!40000 ALTER TABLE `business_hours` DISABLE KEYS */;
INSERT INTO `business_hours` VALUES ('144c4043-387b-4a4e-95a8-5a395e7a5cf1','ed2de3f5-d5b6-4f00-8549-c1078aba153a','TUESDAY','09:00','18:00',1),('168aaa8f-ad5e-403d-a52d-fbf81550bb4b','ed2de3f5-d5b6-4f00-8549-c1078aba153a','SATURDAY','09:00','18:00',1),('1c693a2a-2bfd-43b0-bf39-b39e513d90e7','ed2de3f5-d5b6-4f00-8549-c1078aba153a','SUNDAY','09:00','18:00',0),('36769d11-3117-4e06-9998-44c98e82674d','ed2de3f5-d5b6-4f00-8549-c1078aba153a','WEDNESDAY','09:00','18:00',1),('71e44155-4b09-41b4-86fa-db5537a31286','ed2de3f5-d5b6-4f00-8549-c1078aba153a','MONDAY','09:00','18:00',1),('9eb6abe9-1810-4c91-8780-2cd4edeb73ee','ed2de3f5-d5b6-4f00-8549-c1078aba153a','THURSDAY','09:00','18:00',1),('fd18aa43-1c9a-4642-a334-e7c92b85a4dc','ed2de3f5-d5b6-4f00-8549-c1078aba153a','FRIDAY','09:00','18:00',1);
/*!40000 ALTER TABLE `business_hours` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_refresh_tokens`
--

DROP TABLE IF EXISTS `client_refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_refresh_tokens` (
  `id` varchar(191) NOT NULL,
  `client_id` varchar(191) NOT NULL,
  `token_hash` varchar(191) NOT NULL,
  `token_hint` varchar(191) NOT NULL DEFAULT '',
  `expires_at` datetime(3) NOT NULL,
  `revoked_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `client_refresh_tokens_token_hint_idx` (`token_hint`),
  KEY `client_refresh_tokens_client_id_idx` (`client_id`),
  CONSTRAINT `client_refresh_tokens_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_refresh_tokens`
--

LOCK TABLES `client_refresh_tokens` WRITE;
/*!40000 ALTER TABLE `client_refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_tag_map`
--

DROP TABLE IF EXISTS `client_tag_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_tag_map` (
  `client_id` varchar(191) NOT NULL,
  `tag_id` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`client_id`,`tag_id`),
  KEY `client_tag_map_tag_id_fkey` (`tag_id`),
  CONSTRAINT `client_tag_map_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `client_tag_map_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `client_tags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_tag_map`
--

LOCK TABLES `client_tag_map` WRITE;
/*!40000 ALTER TABLE `client_tag_map` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_tag_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_tags`
--

DROP TABLE IF EXISTS `client_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_tags` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `color` varchar(191) NOT NULL DEFAULT '#6366f1',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `client_tags_tenant_id_name_key` (`tenant_id`,`name`),
  KEY `client_tags_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `client_tags_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_tags`
--

LOCK TABLES `client_tags` WRITE;
/*!40000 ALTER TABLE `client_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `clients` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `first_name` varchar(191) NOT NULL,
  `last_name` varchar(191) NOT NULL,
  `email` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `gender` varchar(191) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `avatar_url` varchar(191) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `source` varchar(191) DEFAULT NULL,
  `password_hash` varchar(191) DEFAULT NULL,
  `portal_registered_at` datetime(3) DEFAULT NULL,
  `last_login_at` datetime(3) DEFAULT NULL,
  `marketplace_user_id` varchar(191) DEFAULT NULL,
  `loyalty_points` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `clients_tenant_id_idx` (`tenant_id`),
  KEY `clients_tenant_id_email_idx` (`tenant_id`,`email`),
  KEY `clients_tenant_id_phone_idx` (`tenant_id`,`phone`),
  KEY `clients_marketplace_user_id_idx` (`marketplace_user_id`),
  CONSTRAINT `clients_marketplace_user_id_fkey` FOREIGN KEY (`marketplace_user_id`) REFERENCES `marketplace_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `clients_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES ('1357cdf7-082e-4ab3-be55-f6ba689151eb','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Alfredo','Rodriguez','alfredo@siliba.com','+1-555-0201',NULL,NULL,NULL,NULL,1,'MARKETPLACE',NULL,'2026-04-02 22:54:29.565',NULL,'697954e4-7995-4620-a506-554dc827c5e2',600,'2026-04-02 22:54:29.566','2026-04-02 22:56:23.853'),('210935bc-8532-49d8-8493-501047851385','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Sarah','Davis','sarah.davis@example.com','+1-555-0303','female',NULL,'Allergic to certain hair dyes - check before coloring','/api/uploads/avatars/client-1773293591733-fgjogy.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.841','2026-04-02 22:54:28.841'),('2cba81f6-0d69-4030-926e-f5dcdf54ed23','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Jessica','Wilson','jessica.wilson@example.com','+1-555-0305','female',NULL,'VIP client - priority booking','/api/uploads/avatars/client-1773293592479-6z1300.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.844','2026-04-02 22:54:28.844'),('40f5033e-50f9-43af-a1ef-78183dd83604','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Emily','Johnson','emily.johnson@example.com','+1-555-0301','female',NULL,'Prefers eco-friendly products','/api/uploads/avatars/client-1773293590857-v6r3xv.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.837','2026-04-02 22:54:28.837'),('4d1dd1bd-ff28-4663-a84e-957daabb220d','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Andrea','Lopez','andrea.lopez@example.com','+1-555-0306','female',NULL,'Prefiere citas por la manana','/api/uploads/avatars/client-1773293592839-2dewab.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.845','2026-04-02 22:54:28.845'),('519f8853-d126-4066-ad04-ff2cedd8315c','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Michael','Brown','michael.brown@example.com','+1-555-0302','male',NULL,'Regular monthly haircut','/api/uploads/avatars/client-1773293591359-fzfcza.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.839','2026-04-02 22:54:28.839'),('a1972e03-5cdb-4fdf-9b8b-826eaaa859bb','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Laura','Hernandez','laura.hernandez@example.com','+1-555-0308','female',NULL,'Cliente frecuente, le gusta probar cosas nuevas','/api/uploads/avatars/client-1773293593570-ykebg2.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.848','2026-04-02 22:54:28.848'),('a7f4a2af-5a59-4b0f-a0e0-63abe0ff99d3','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Carlos','Ramirez','carlos.ramirez@example.com','+1-555-0307','male',NULL,NULL,'/api/uploads/avatars/client-1773293593212-ipzmbg.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.847','2026-04-02 22:54:28.847'),('bca8124c-fe45-4a6d-99fb-8715cf094212','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Valentina','Diaz','valentina.diaz@example.com','+1-555-0310','female',NULL,'Piel sensible - verificar productos','/api/uploads/avatars/client-1773293594318-am9s78.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.851','2026-04-02 22:54:28.851'),('cc6c876f-ed4b-4584-846c-7724e82c18f7','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Roberto','Torres','roberto.torres@example.com','+1-555-0309','male',NULL,'Corte clasico siempre','/api/uploads/avatars/client-1773293593945-n0ocgq.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.849','2026-04-02 22:54:28.849'),('deab6e4b-4a5f-48d0-9bc6-1c1316a0ddad','ed2de3f5-d5b6-4f00-8549-c1078aba153a','David','Miller','david.miller@example.com','+1-555-0304','male',NULL,NULL,'/api/uploads/avatars/client-1773293592105-1q6bhv.jpg',1,'MANUAL',NULL,NULL,NULL,NULL,0,'2026-04-02 22:54:28.842','2026-04-02 22:54:28.842');
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `domain_events`
--

DROP TABLE IF EXISTS `domain_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `domain_events` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `event_name` varchar(191) NOT NULL,
  `aggregate_type` varchar(191) NOT NULL,
  `aggregate_id` varchar(191) NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `processed_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `domain_events_tenant_id_created_at_idx` (`tenant_id`,`created_at`),
  KEY `domain_events_event_name_idx` (`event_name`),
  KEY `domain_events_processed_at_idx` (`processed_at`),
  CONSTRAINT `domain_events_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `domain_events`
--

LOCK TABLES `domain_events` WRITE;
/*!40000 ALTER TABLE `domain_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `domain_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_documents`
--

DROP TABLE IF EXISTS `employee_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_documents` (
  `id` varchar(191) NOT NULL,
  `employee_id` varchar(191) NOT NULL,
  `document_type` varchar(50) NOT NULL,
  `file_url` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_documents_employee_id_document_type_key` (`employee_id`,`document_type`),
  KEY `employee_documents_employee_id_idx` (`employee_id`),
  CONSTRAINT `employee_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_documents`
--

LOCK TABLES `employee_documents` WRITE;
/*!40000 ALTER TABLE `employee_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_portfolio_images`
--

DROP TABLE IF EXISTS `employee_portfolio_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_portfolio_images` (
  `id` varchar(191) NOT NULL,
  `employee_id` varchar(191) NOT NULL,
  `image_url` varchar(191) NOT NULL,
  `caption` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `employee_portfolio_images_employee_id_idx` (`employee_id`),
  CONSTRAINT `employee_portfolio_images_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_portfolio_images`
--

LOCK TABLES `employee_portfolio_images` WRITE;
/*!40000 ALTER TABLE `employee_portfolio_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_portfolio_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_reviews`
--

DROP TABLE IF EXISTS `employee_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_reviews` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `employee_id` varchar(191) NOT NULL,
  `client_id` varchar(191) NOT NULL,
  `appointment_id` varchar(191) NOT NULL,
  `rating` int(11) NOT NULL,
  `comment` text DEFAULT NULL,
  `business_rating` int(11) DEFAULT NULL,
  `business_comment` text DEFAULT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `reviewed_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_reviews_appointment_id_key` (`appointment_id`),
  KEY `employee_reviews_employee_id_idx` (`employee_id`),
  KEY `employee_reviews_tenant_id_idx` (`tenant_id`),
  KEY `employee_reviews_client_id_fkey` (`client_id`),
  CONSTRAINT `employee_reviews_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `employee_reviews_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `employee_reviews_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `employee_reviews_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_reviews`
--

LOCK TABLES `employee_reviews` WRITE;
/*!40000 ALTER TABLE `employee_reviews` DISABLE KEYS */;
INSERT INTO `employee_reviews` VALUES ('105740cd-e8a5-4e01-a807-ef165e5c0bbb','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','a1972e03-5cdb-4fdf-9b8b-826eaaa859bb','a04f492c-2682-4c3c-905d-1fd5acf8773f',4,'Ya perdi la cuenta de cuantas veces he venido. Es mi lugar seguro. Siempre salgo feliz y con ganas de volver.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.987','2026-04-02 22:54:28.987'),('2d12745c-1cfe-4cc6-9e16-15319be18828','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','4d1dd1bd-ff28-4663-a84e-957daabb220d','50876634-b8dd-4652-81a6-b632cb370305',5,'Honestamente no esperaba tanto. Me hicieron un cambio de look completo y no podia dejar de mirarme al espejo. 100% recomendado.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.984','2026-04-02 22:54:28.984'),('34c9e3c7-b838-4165-854d-7460081f118e','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','a7f4a2af-5a59-4b0f-a0e0-63abe0ff99d3','21dafda3-bccd-4f8c-9312-40aa553c54dd',5,'Vine nerviosa porque nunca me habia tenido el cabello. Me explicaron todo el proceso con paciencia y el resultado fue espectacular.',NULL,NULL,1,NULL,'2026-04-02 22:54:29.001','2026-04-02 22:54:29.001'),('3eda6f26-6776-4d51-86e9-133f3698af40','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','deab6e4b-4a5f-48d0-9bc6-1c1316a0ddad','2f5b3fee-6bc1-47f6-8f7c-a9f756babdac',5,'Fui por un corte sencillo y sali con un look que me hizo sentir 10 anos mas joven. Manos magicas, sin duda.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.992','2026-04-02 22:54:28.992'),('4c45f9e1-fc07-4274-b300-82ad9e77bfe6','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','40f5033e-50f9-43af-a1ef-78183dd83604','9ce63b3d-d350-45e9-bd1d-bc9ffa07de1e',4,'El ambiente es super relajante y el trato es de primera. Me encanta que se toman el tiempo de escucharte antes de empezar.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.983','2026-04-02 22:54:28.983'),('4eed9ca7-7bd8-4f32-9482-34d99b31ea03','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','40f5033e-50f9-43af-a1ef-78183dd83604','4a42a131-eb87-41e7-aa6a-6a7143f34fd1',4,'El ambiente es super relajante y el trato es de primera. Me encanta que se toman el tiempo de escucharte antes de empezar.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.969','2026-04-02 22:54:28.969'),('5a3f95db-49d2-4ff1-bc70-0ecd6bb495fe','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','519f8853-d126-4066-ad04-ff2cedd8315c','3efc1263-fcfc-4017-85a7-b629ecc12c13',5,'Lo que mas valoro es la honestidad. Me dijeron que lo que queria no iba con mi tipo de rostro y me sugirieron algo mejor. Tenian toda la razon.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.971','2026-04-02 22:54:28.971'),('5f5a0637-0789-490c-b277-d894a903ed02','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','210935bc-8532-49d8-8493-501047851385','a2825bb3-62bb-4a4b-b31e-f625ff8865bb',5,'Increible experiencia. Maria tiene un don para entender exactamente lo que quieres sin tener que explicar demasiado. Sali sintiendome otra persona.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.964','2026-04-02 22:54:28.964'),('68fdc83f-fd62-452c-bd96-f7e2b280bf90','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','2cba81f6-0d69-4030-926e-f5dcdf54ed23','959d189e-6a8f-497f-8903-6ab962f0d08f',5,'Llevaba meses buscando a alguien que entendiera mi tipo de cabello. Desde la primera visita supe que habia encontrado a mi estilista de confianza.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.994','2026-04-02 22:54:28.994'),('6feab9b0-37fb-438e-babe-24e949803411','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','2cba81f6-0d69-4030-926e-f5dcdf54ed23','250ae67c-9b3b-4977-b6ff-8b1344f051a8',5,'Llevaba meses buscando a alguien que entendiera mi tipo de cabello. Desde la primera visita supe que habia encontrado a mi estilista de confianza.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.982','2026-04-02 22:54:28.982'),('777c3be8-7542-4ff7-9464-f7493f3203f8','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','2cba81f6-0d69-4030-926e-f5dcdf54ed23','cca637f3-6206-4f2d-83fd-f6c1b5b61c2b',5,'Llevaba meses buscando a alguien que entendiera mi tipo de cabello. Desde la primera visita supe que habia encontrado a mi estilista de confianza.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.966','2026-04-02 22:54:28.966'),('8c13aeea-fff5-4930-b394-868a3cd7118f','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','a1972e03-5cdb-4fdf-9b8b-826eaaa859bb','78c8498a-75af-45e6-a5ca-6e3ba5e78532',4,'Ya perdi la cuenta de cuantas veces he venido. Es mi lugar seguro. Siempre salgo feliz y con ganas de volver.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.973','2026-04-02 22:54:28.973'),('91c0983d-15e3-40d4-9395-1a9154e8399a','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','bca8124c-fe45-4a6d-99fb-8715cf094212','72f1bd66-70dd-4287-87b0-5c6356b16066',5,'Excelente atencion al detalle. Se nota que aman lo que hacen. El salon esta impecable y el equipo es muy profesional.',NULL,NULL,1,NULL,'2026-04-02 22:54:29.003','2026-04-02 22:54:29.003'),('99f01ff4-fda9-4cbc-8262-c51aaea39b88','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','cc6c876f-ed4b-4584-846c-7724e82c18f7','6f4f46c5-54f2-4208-a12b-bc0e5028a5ff',4,'Mi hija me recomendo este salon y ahora entiendo por que. La atencion es personalizada y el resultado habla por si solo.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.977','2026-04-02 22:54:28.977'),('9afd01db-a9e9-4e31-b7d6-767981faf66b','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','4d1dd1bd-ff28-4663-a84e-957daabb220d','7dc79409-df1e-41b2-8a3b-f2260a2e2124',5,'Honestamente no esperaba tanto. Me hicieron un cambio de look completo y no podia dejar de mirarme al espejo. 100% recomendado.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.970','2026-04-02 22:54:28.970'),('9c57b272-4706-4b14-878c-3f9275a744cd','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','210935bc-8532-49d8-8493-501047851385','70e1c1f9-2536-4a87-b6e8-eb27cc29c405',5,'Increible experiencia. Maria tiene un don para entender exactamente lo que quieres sin tener que explicar demasiado. Sali sintiendome otra persona.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.980','2026-04-02 22:54:28.980'),('a9704adb-38a2-4783-a017-4299add28320','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','4d1dd1bd-ff28-4663-a84e-957daabb220d','8cd3fdcb-dce7-4e1f-8193-418d4991545b',5,'Honestamente no esperaba tanto. Me hicieron un cambio de look completo y no podia dejar de mirarme al espejo. 100% recomendado.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.997','2026-04-02 22:54:28.997'),('aa595eb9-78b7-4157-9025-837ae8036c70','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','bca8124c-fe45-4a6d-99fb-8715cf094212','b262460c-72f2-41eb-9aa8-55bcd9b9a425',5,'Excelente atencion al detalle. Se nota que aman lo que hacen. El salon esta impecable y el equipo es muy profesional.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.976','2026-04-02 22:54:28.976'),('bae6564a-5e30-4443-bf09-8fafcde7376d','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','a7f4a2af-5a59-4b0f-a0e0-63abe0ff99d3','3162b083-3963-42b0-954d-92df3d0471e2',5,'Vine nerviosa porque nunca me habia tenido el cabello. Me explicaron todo el proceso con paciencia y el resultado fue espectacular.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.988','2026-04-02 22:54:28.988'),('bd45c99b-3721-4a68-ab35-f37e22229be5','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','cc6c876f-ed4b-4584-846c-7724e82c18f7','e05a0017-b0d5-4ad1-a8a5-94538b52e6b4',4,'Mi hija me recomendo este salon y ahora entiendo por que. La atencion es personalizada y el resultado habla por si solo.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.991','2026-04-02 22:54:28.991'),('c36c78bf-334d-4b58-a18e-4b763368108a','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','210935bc-8532-49d8-8493-501047851385','2842dce9-ce9d-4b03-a129-12f9d4496df1',5,'Increible experiencia. Maria tiene un don para entender exactamente lo que quieres sin tener que explicar demasiado. Sali sintiendome otra persona.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.993','2026-04-02 22:54:28.993'),('c61e7732-7634-4e81-819e-e089c77ad1c6','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','519f8853-d126-4066-ad04-ff2cedd8315c','07d944a1-3342-439b-8f36-c2234485566c',5,'Lo que mas valoro es la honestidad. Me dijeron que lo que queria no iba con mi tipo de rostro y me sugirieron algo mejor. Tenian toda la razon.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.999','2026-04-02 22:54:28.999'),('cfef62f0-8b1c-4d73-8b13-4cb05c57cc57','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','a7f4a2af-5a59-4b0f-a0e0-63abe0ff99d3','a76dffbb-7e51-4437-802b-698cac8615fa',5,'Vine nerviosa porque nunca me habia tenido el cabello. Me explicaron todo el proceso con paciencia y el resultado fue espectacular.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.974','2026-04-02 22:54:28.974'),('d018b21e-2f41-4d96-9921-c065fbf116f1','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','40f5033e-50f9-43af-a1ef-78183dd83604','2a4fcb33-a1bf-4f6d-824c-4e55c15b6ce8',4,'El ambiente es super relajante y el trato es de primera. Me encanta que se toman el tiempo de escucharte antes de empezar.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.996','2026-04-02 22:54:28.996'),('d3d346a0-2704-4204-9edf-a68e264c3644','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','bca8124c-fe45-4a6d-99fb-8715cf094212','e69b5abd-7f3c-49ff-a6ef-14d1a263e685',5,'Excelente atencion al detalle. Se nota que aman lo que hacen. El salon esta impecable y el equipo es muy profesional.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.989','2026-04-02 22:54:28.989'),('d84ac968-a9e4-4a42-aeaa-604c0d1026df','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','a1972e03-5cdb-4fdf-9b8b-826eaaa859bb','66ecaa9d-4270-49bf-99f5-24d4b328d072',4,'Ya perdi la cuenta de cuantas veces he venido. Es mi lugar seguro. Siempre salgo feliz y con ganas de volver.',NULL,NULL,1,NULL,'2026-04-02 22:54:29.000','2026-04-02 22:54:29.000'),('e25f705a-a09b-434f-863d-203e83dfa420','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','cc6c876f-ed4b-4584-846c-7724e82c18f7','2cd1e2f0-729e-40bc-adcb-87f61b39895f',4,'Mi hija me recomendo este salon y ahora entiendo por que. La atencion es personalizada y el resultado habla por si solo.',NULL,NULL,1,NULL,'2026-04-02 22:54:29.004','2026-04-02 22:54:29.004'),('e83c8a89-2faf-4cb0-915c-64552446a64a','ed2de3f5-d5b6-4f00-8549-c1078aba153a','8e1a6790-9765-458f-9630-c21b478fd7e1','deab6e4b-4a5f-48d0-9bc6-1c1316a0ddad','4283dcf7-860b-47f0-b0dc-2ea5a5305b2d',5,'Fui por un corte sencillo y sali con un look que me hizo sentir 10 anos mas joven. Manos magicas, sin duda.',NULL,NULL,1,NULL,'2026-04-02 22:54:29.005','2026-04-02 22:54:29.005'),('f9751639-3b08-4873-947d-443b6344e192','ed2de3f5-d5b6-4f00-8549-c1078aba153a','7b2b44ff-061b-4074-ae2c-fb1a341e942c','519f8853-d126-4066-ad04-ff2cedd8315c','a357da6d-6688-4c6e-a6fa-4d518c887a9b',5,'Lo que mas valoro es la honestidad. Me dijeron que lo que queria no iba con mi tipo de rostro y me sugirieron algo mejor. Tenian toda la razon.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.985','2026-04-02 22:54:28.985'),('fec48128-22e6-4b51-ae30-483f0d1b0b6e','ed2de3f5-d5b6-4f00-8549-c1078aba153a','0f274d2c-1a87-4cb0-ba07-ddea21590435','deab6e4b-4a5f-48d0-9bc6-1c1316a0ddad','14b866ed-66fa-4bcd-81a9-f39950ac9e59',5,'Fui por un corte sencillo y sali con un look que me hizo sentir 10 anos mas joven. Manos magicas, sin duda.',NULL,NULL,1,NULL,'2026-04-02 22:54:28.979','2026-04-02 22:54:28.979');
/*!40000 ALTER TABLE `employee_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_schedules`
--

DROP TABLE IF EXISTS `employee_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_schedules` (
  `id` varchar(191) NOT NULL,
  `employee_id` varchar(191) NOT NULL,
  `day_of_week` enum('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') NOT NULL,
  `start_time` varchar(191) NOT NULL,
  `end_time` varchar(191) NOT NULL,
  `is_working` tinyint(1) NOT NULL DEFAULT 1,
  `effective_from` date NOT NULL,
  `effective_until` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `employee_schedules_employee_id_day_of_week_idx` (`employee_id`,`day_of_week`),
  KEY `employee_schedules_employee_id_effective_from_idx` (`employee_id`,`effective_from`),
  CONSTRAINT `employee_schedules_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_schedules`
--

LOCK TABLES `employee_schedules` WRITE;
/*!40000 ALTER TABLE `employee_schedules` DISABLE KEYS */;
INSERT INTO `employee_schedules` VALUES ('09f1d0b6-fff2-4ded-a2e6-1df26b0ae6b4','0f274d2c-1a87-4cb0-ba07-ddea21590435','FRIDAY','09:00','18:00',1,'2024-01-01',NULL),('17567153-e387-46cf-a820-65e1302aadd2','7b2b44ff-061b-4074-ae2c-fb1a341e942c','THURSDAY','09:00','18:00',1,'2024-01-01',NULL),('24072151-a012-43d4-81cc-eca60bce1dfd','7b2b44ff-061b-4074-ae2c-fb1a341e942c','SUNDAY','09:00','18:00',0,'2024-01-01',NULL),('3a60d424-a9d9-40d9-8ff7-4e3f72c95651','7b2b44ff-061b-4074-ae2c-fb1a341e942c','WEDNESDAY','09:00','18:00',1,'2024-01-01',NULL),('480ff0fe-4c04-4f8d-bcb8-cc7c557ca44f','8e1a6790-9765-458f-9630-c21b478fd7e1','FRIDAY','09:00','18:00',1,'2024-01-01',NULL),('4cd4184e-6fa2-4f61-a2c2-30cce16aca8a','8e1a6790-9765-458f-9630-c21b478fd7e1','TUESDAY','09:00','18:00',1,'2024-01-01',NULL),('54593e89-21ac-4c65-9795-59ab5a671ed8','7b2b44ff-061b-4074-ae2c-fb1a341e942c','FRIDAY','09:00','18:00',1,'2024-01-01',NULL),('5b5ed08c-90b1-47d3-9ed0-ac5de3488df9','7b2b44ff-061b-4074-ae2c-fb1a341e942c','TUESDAY','09:00','18:00',1,'2024-01-01',NULL),('5c0beb22-fcd1-4845-b1b5-10f104aac9d6','8e1a6790-9765-458f-9630-c21b478fd7e1','SATURDAY','09:00','18:00',1,'2024-01-01',NULL),('6958017a-0fac-4d9c-8843-2cc8dbaebe03','8e1a6790-9765-458f-9630-c21b478fd7e1','MONDAY','09:00','18:00',1,'2024-01-01',NULL),('6e17786c-a58e-456d-9fac-282145cd0336','8e1a6790-9765-458f-9630-c21b478fd7e1','SUNDAY','09:00','18:00',0,'2024-01-01',NULL),('7919da36-adc0-46e9-9285-11850772f217','7b2b44ff-061b-4074-ae2c-fb1a341e942c','SATURDAY','09:00','18:00',1,'2024-01-01',NULL),('7b9ea73f-2634-4e54-beaa-0553b76ec9a3','0f274d2c-1a87-4cb0-ba07-ddea21590435','MONDAY','09:00','18:00',1,'2024-01-01',NULL),('88a71f22-c95b-4dd1-bcf5-943b8f70fdec','0f274d2c-1a87-4cb0-ba07-ddea21590435','SATURDAY','09:00','18:00',1,'2024-01-01',NULL),('8cb5403a-ed7f-4475-acbd-ccd2bbb0629a','0f274d2c-1a87-4cb0-ba07-ddea21590435','THURSDAY','09:00','18:00',1,'2024-01-01',NULL),('992d7d78-4ff9-44dd-9502-112af502a3a2','8e1a6790-9765-458f-9630-c21b478fd7e1','THURSDAY','09:00','18:00',1,'2024-01-01',NULL),('9f8e3a5d-770a-45a2-a6fb-74780f9b0f5b','0f274d2c-1a87-4cb0-ba07-ddea21590435','WEDNESDAY','09:00','18:00',1,'2024-01-01',NULL),('a4f531c7-7253-4931-b02a-9b20a53b2c08','8e1a6790-9765-458f-9630-c21b478fd7e1','WEDNESDAY','09:00','18:00',1,'2024-01-01',NULL),('a8e82cc1-deb4-4d21-83e6-f4ee1e82b4b0','7b2b44ff-061b-4074-ae2c-fb1a341e942c','MONDAY','09:00','18:00',1,'2024-01-01',NULL),('d70e3b96-8ecc-4438-9da2-8421dfa84726','0f274d2c-1a87-4cb0-ba07-ddea21590435','TUESDAY','09:00','18:00',1,'2024-01-01',NULL),('f5b13707-a156-4777-8c69-d13c0009043e','0f274d2c-1a87-4cb0-ba07-ddea21590435','SUNDAY','09:00','18:00',0,'2024-01-01',NULL);
/*!40000 ALTER TABLE `employee_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_services`
--

DROP TABLE IF EXISTS `employee_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_services` (
  `employee_id` varchar(191) NOT NULL,
  `service_id` varchar(191) NOT NULL,
  `custom_price` decimal(10,2) DEFAULT NULL,
  `custom_duration` int(11) DEFAULT NULL,
  `commission` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`employee_id`,`service_id`),
  KEY `employee_services_service_id_fkey` (`service_id`),
  CONSTRAINT `employee_services_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `employee_services_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_services`
--

LOCK TABLES `employee_services` WRITE;
/*!40000 ALTER TABLE `employee_services` DISABLE KEYS */;
INSERT INTO `employee_services` VALUES ('0f274d2c-1a87-4cb0-ba07-ddea21590435','094d585d-29ed-489a-8230-23d5c9c50cf5',NULL,NULL,15.00),('0f274d2c-1a87-4cb0-ba07-ddea21590435','12a84508-ff1d-4f4d-a88d-f8cef7a369e4',NULL,NULL,40.00),('7b2b44ff-061b-4074-ae2c-fb1a341e942c','0b240314-0a21-4c06-a74b-6a98a7f966b5',NULL,NULL,25.00),('7b2b44ff-061b-4074-ae2c-fb1a341e942c','fe0ec01d-c98f-4338-99c5-529ccb656627',NULL,NULL,12.00),('8e1a6790-9765-458f-9630-c21b478fd7e1','094d585d-29ed-489a-8230-23d5c9c50cf5',NULL,NULL,15.00),('8e1a6790-9765-458f-9630-c21b478fd7e1','12a84508-ff1d-4f4d-a88d-f8cef7a369e4',NULL,NULL,40.00),('8e1a6790-9765-458f-9630-c21b478fd7e1','f2ae6230-1d04-47f2-ba46-f116707e8e30',NULL,NULL,20.00);
/*!40000 ALTER TABLE `employee_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_time_off`
--

DROP TABLE IF EXISTS `employee_time_off`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_time_off` (
  `id` varchar(191) NOT NULL,
  `employee_id` varchar(191) NOT NULL,
  `start_datetime` datetime(3) NOT NULL,
  `end_datetime` datetime(3) NOT NULL,
  `reason` varchar(191) DEFAULT NULL,
  `is_all_day` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(191) NOT NULL DEFAULT 'APPROVED',
  `approved_by` varchar(191) DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `employee_time_off_employee_id_start_datetime_end_datetime_idx` (`employee_id`,`start_datetime`,`end_datetime`),
  CONSTRAINT `employee_time_off_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_time_off`
--

LOCK TABLES `employee_time_off` WRITE;
/*!40000 ALTER TABLE `employee_time_off` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_time_off` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_trainings`
--

DROP TABLE IF EXISTS `employee_trainings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_trainings` (
  `id` varchar(191) NOT NULL,
  `employee_id` varchar(191) NOT NULL,
  `title` varchar(200) NOT NULL,
  `institution` varchar(200) DEFAULT NULL,
  `date_completed` date DEFAULT NULL,
  `file_url` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `employee_trainings_employee_id_idx` (`employee_id`),
  CONSTRAINT `employee_trainings_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_trainings`
--

LOCK TABLES `employee_trainings` WRITE;
/*!40000 ALTER TABLE `employee_trainings` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_trainings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employees` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `user_id` varchar(191) DEFAULT NULL,
  `location_id` varchar(191) NOT NULL,
  `first_name` varchar(191) NOT NULL,
  `last_name` varchar(191) NOT NULL,
  `email` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `avatar_url` varchar(191) DEFAULT NULL,
  `cover_image_url` varchar(191) DEFAULT NULL,
  `color` varchar(191) NOT NULL DEFAULT '#008080',
  `bio` text DEFAULT NULL,
  `blood_type` varchar(5) DEFAULT NULL,
  `emergency_contact_name` varchar(191) DEFAULT NULL,
  `emergency_contact_last_name` varchar(191) DEFAULT NULL,
  `emergency_contact_phone` varchar(191) DEFAULT NULL,
  `emergency_contact_relation` varchar(50) DEFAULT NULL,
  `allergies` text DEFAULT NULL,
  `job_title` varchar(191) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `buffer_before_minutes` int(11) NOT NULL DEFAULT 0,
  `buffer_after_minutes` int(11) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employees_user_id_key` (`user_id`),
  KEY `employees_tenant_id_idx` (`tenant_id`),
  KEY `employees_tenant_id_location_id_idx` (`tenant_id`,`location_id`),
  KEY `employees_location_id_fkey` (`location_id`),
  CONSTRAINT `employees_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `employees_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `employees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES ('0f274d2c-1a87-4cb0-ba07-ddea21590435','ed2de3f5-d5b6-4f00-8549-c1078aba153a','923384c3-3ef5-4ffe-8947-31cbb819dc30','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','James','Wilson','james@demo-salon.com','+1-555-0202','/api/uploads/avatars/employee-1772686783325-m0beni.jpg',NULL,'#10b981','Creci en un barrio donde los hombres no hablaban de estilo. Yo fui el primero en desafiar eso. Hoy, despues de 8 anos perfeccionando mi arte, cada tinte que mezclo lleva algo de mi alma. Me inspiran los atardeceres, la musica y esos clientes que llegan nerviosos y se van sintiendose invencibles.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,0,0,'2026-04-02 22:54:28.625','2026-04-02 22:56:23.127'),('7b2b44ff-061b-4074-ae2c-fb1a341e942c','ed2de3f5-d5b6-4f00-8549-c1078aba153a','6ce839aa-901e-49a4-a13d-c78ce173c0c6','4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','Sofia','Martinez','sofia@demo-salon.com','+1-555-0203','/api/uploads/avatars/employee-1772686783699-hoe75s.jpg',NULL,'#f59e0b','Mi abuela siempre decia: \"las manos hablan de quien eres\". Esas palabras me marcaron para siempre. Llevo 6 anos dedicada al cuidado personal y cada clienta que atiendo se convierte en familia. Un facial no es solo un tratamiento — es una hora donde el mundo se detiene y tu eres lo unico que importa.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,0,0,'2026-04-02 22:54:28.636','2026-04-02 22:56:23.129'),('8e1a6790-9765-458f-9630-c21b478fd7e1','ed2de3f5-d5b6-4f00-8549-c1078aba153a','89a47421-1dc8-4cf6-ab08-202bb5d569d3','c17e31e0-ff8a-4f89-84d2-ec3f255aea77','Maria','Garcia','maria@demo-salon.com','+1-555-0201','/api/uploads/avatars/employee-1772686782829-95dnt0.jpg',NULL,'#6366f1','Tengo 10 anos transformando vidas desde mi silla. Mi mama me ensenó que la belleza no es vanidad, es amor propio. Cada persona que se sienta frente a mi espejo llega con una historia, y mi trabajo es ayudarla a sentirse como la protagonista que es. No solo corto cabello — devuelvo sonrisas.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,0,0,'2026-04-02 22:54:28.609','2026-04-02 22:56:23.124');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoices` (
  `id` varchar(191) NOT NULL,
  `subscription_id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `invoice_number` varchar(191) NOT NULL,
  `amount_usd` decimal(10,2) NOT NULL,
  `base_amount` decimal(10,2) DEFAULT NULL,
  `employee_amount` decimal(10,2) DEFAULT NULL,
  `employee_count` int(11) DEFAULT NULL,
  `status` enum('PENDING','PAID','OVERDUE','VOID') NOT NULL DEFAULT 'PENDING',
  `period_start` datetime(3) NOT NULL,
  `period_end` datetime(3) NOT NULL,
  `due_date` datetime(3) NOT NULL,
  `paid_at` datetime(3) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `stripe_invoice_id` varchar(255) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoices_invoice_number_key` (`invoice_number`),
  KEY `invoices_tenant_id_idx` (`tenant_id`),
  KEY `invoices_subscription_id_idx` (`subscription_id`),
  KEY `invoices_status_idx` (`status`),
  CONSTRAINT `invoices_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invoices_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
INSERT INTO `invoices` VALUES ('774764c2-1d00-4e85-9d92-3ada27608094','29ed22ae-8b71-4f36-81d3-290ee8a89bf8','ed2de3f5-d5b6-4f00-8549-c1078aba153a','INV-2026-0001',29.99,NULL,NULL,NULL,'PAID','2026-04-02 22:54:29.188','2026-05-02 22:54:29.188','2026-05-02 22:54:29.188','2026-04-02 22:54:29.188',NULL,NULL,'2026-04-02 22:54:29.191','2026-04-02 22:54:29.191');
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `locations` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `address` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `timezone` varchar(191) DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`settings`)),
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `locations_tenant_id_name_key` (`tenant_id`,`name`),
  KEY `locations_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `locations_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locations`
--

LOCK TABLES `locations` WRITE;
/*!40000 ALTER TABLE `locations` DISABLE KEYS */;
INSERT INTO `locations` VALUES ('4ab7dad9-e09c-4e8a-865d-8b1ce52d9252','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Mall Branch','456 Shopping Center Blvd, New York, NY 10002','+1-555-0102','mall@demo-salon.com','America/New_York',40.758,-73.9855,1,'{}','2026-04-02 22:54:28.418','2026-04-02 22:56:23.516'),('c17e31e0-ff8a-4f89-84d2-ec3f255aea77','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Downtown Branch','123 Main Street, New York, NY 10001','+1-555-0101','downtown@demo-salon.com','America/New_York',40.7128,-74.006,1,'{}','2026-04-02 22:54:28.416','2026-04-02 22:56:23.514');
/*!40000 ALTER TABLE `locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `marketplace_favorites`
--

DROP TABLE IF EXISTS `marketplace_favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketplace_favorites` (
  `id` varchar(191) NOT NULL,
  `marketplace_user_id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `marketplace_favorites_marketplace_user_id_tenant_id_key` (`marketplace_user_id`,`tenant_id`),
  KEY `marketplace_favorites_marketplace_user_id_idx` (`marketplace_user_id`),
  KEY `marketplace_favorites_tenant_id_fkey` (`tenant_id`),
  CONSTRAINT `marketplace_favorites_marketplace_user_id_fkey` FOREIGN KEY (`marketplace_user_id`) REFERENCES `marketplace_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `marketplace_favorites_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `marketplace_favorites`
--

LOCK TABLES `marketplace_favorites` WRITE;
/*!40000 ALTER TABLE `marketplace_favorites` DISABLE KEYS */;
/*!40000 ALTER TABLE `marketplace_favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `marketplace_professional_favorites`
--

DROP TABLE IF EXISTS `marketplace_professional_favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketplace_professional_favorites` (
  `id` varchar(191) NOT NULL,
  `marketplace_user_id` varchar(191) NOT NULL,
  `employee_id` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `marketplace_professional_favorites_marketplace_user_id_emplo_key` (`marketplace_user_id`,`employee_id`),
  KEY `marketplace_professional_favorites_marketplace_user_id_idx` (`marketplace_user_id`),
  KEY `marketplace_professional_favorites_employee_id_fkey` (`employee_id`),
  CONSTRAINT `marketplace_professional_favorites_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `marketplace_professional_favorites_marketplace_user_id_fkey` FOREIGN KEY (`marketplace_user_id`) REFERENCES `marketplace_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `marketplace_professional_favorites`
--

LOCK TABLES `marketplace_professional_favorites` WRITE;
/*!40000 ALTER TABLE `marketplace_professional_favorites` DISABLE KEYS */;
/*!40000 ALTER TABLE `marketplace_professional_favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `marketplace_refresh_tokens`
--

DROP TABLE IF EXISTS `marketplace_refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketplace_refresh_tokens` (
  `id` varchar(191) NOT NULL,
  `marketplace_user_id` varchar(191) NOT NULL,
  `token_hash` varchar(191) NOT NULL,
  `token_hint` varchar(8) NOT NULL DEFAULT '',
  `expires_at` datetime(3) NOT NULL,
  `revoked_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `marketplace_refresh_tokens_marketplace_user_id_idx` (`marketplace_user_id`),
  CONSTRAINT `marketplace_refresh_tokens_marketplace_user_id_fkey` FOREIGN KEY (`marketplace_user_id`) REFERENCES `marketplace_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `marketplace_refresh_tokens`
--

LOCK TABLES `marketplace_refresh_tokens` WRITE;
/*!40000 ALTER TABLE `marketplace_refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `marketplace_refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `marketplace_users`
--

DROP TABLE IF EXISTS `marketplace_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketplace_users` (
  `id` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `password_hash` varchar(191) DEFAULT NULL,
  `social_provider` varchar(20) DEFAULT NULL,
  `social_id` varchar(255) DEFAULT NULL,
  `first_name` varchar(191) NOT NULL,
  `last_name` varchar(191) NOT NULL,
  `avatar_url` varchar(191) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `allergies` text DEFAULT NULL,
  `country` varchar(2) DEFAULT NULL,
  `language` varchar(5) NOT NULL DEFAULT 'es',
  `currency` varchar(10) NOT NULL DEFAULT 'LOCAL',
  `search_radius` int(11) NOT NULL DEFAULT 25,
  `notif_appointments` tinyint(1) NOT NULL DEFAULT 1,
  `notif_promotions` tinyint(1) NOT NULL DEFAULT 1,
  `notif_rewards` tinyint(1) NOT NULL DEFAULT 1,
  `notif_messages` tinyint(1) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `suspended_at` datetime(3) DEFAULT NULL,
  `suspended_until` datetime(3) DEFAULT NULL,
  `last_login_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `marketplace_users_email_key` (`email`),
  UNIQUE KEY `marketplace_users_phone_key` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `marketplace_users`
--

LOCK TABLES `marketplace_users` WRITE;
/*!40000 ALTER TABLE `marketplace_users` DISABLE KEYS */;
INSERT INTO `marketplace_users` VALUES ('697954e4-7995-4620-a506-554dc827c5e2','alfredo@siliba.com','+1-555-0201','$2b$12$eEmtqYzVUwRtTFdHPyGwweO8GrCVp7eBK7n4RpbUdOg6.kZKYfC8K',NULL,NULL,'Alfredo','Rodriguez',NULL,NULL,NULL,NULL,NULL,'es','LOCAL',25,1,1,1,1,1,NULL,NULL,NULL,'2026-04-02 22:54:29.555','2026-04-02 22:54:29.555'),('cd7aa8fe-c843-40b1-a240-aa5e6fec8f7b','cliente@siliba.com','+1-555-0200','$2b$12$5CSwwRdOzLp8E5VZK3lLw.PVqRk321DCThV9HTm50KgKHkqlCwAZi',NULL,NULL,'Maria','Garcia',NULL,NULL,NULL,NULL,NULL,'es','LOCAL',25,1,1,1,1,1,NULL,NULL,NULL,'2026-04-02 22:54:29.389','2026-04-02 22:54:29.389');
/*!40000 ALTER TABLE `marketplace_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_logs`
--

DROP TABLE IF EXISTS `notification_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notification_logs` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `template_id` varchar(191) DEFAULT NULL,
  `channel` enum('EMAIL','SMS','WHATSAPP','PUSH') NOT NULL,
  `event_name` varchar(191) NOT NULL,
  `recipient_email` varchar(191) DEFAULT NULL,
  `recipient_phone` varchar(191) DEFAULT NULL,
  `subject` varchar(191) DEFAULT NULL,
  `body` text NOT NULL,
  `status` enum('SENT','FAILED') NOT NULL,
  `error` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `sent_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `notification_logs_tenant_id_created_at_idx` (`tenant_id`,`created_at`),
  KEY `notification_logs_tenant_id_event_name_idx` (`tenant_id`,`event_name`),
  KEY `notification_logs_status_idx` (`status`),
  KEY `notification_logs_template_id_fkey` (`template_id`),
  CONSTRAINT `notification_logs_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `notification_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_logs`
--

LOCK TABLES `notification_logs` WRITE;
/*!40000 ALTER TABLE `notification_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_templates`
--

DROP TABLE IF EXISTS `notification_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notification_templates` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `type` enum('EMAIL','SMS','WHATSAPP','PUSH') NOT NULL,
  `event_trigger` varchar(191) NOT NULL,
  `subject` varchar(191) DEFAULT NULL,
  `body_template` text NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `notification_templates_tenant_id_event_trigger_idx` (`tenant_id`,`event_trigger`),
  CONSTRAINT `notification_templates_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_templates`
--

LOCK TABLES `notification_templates` WRITE;
/*!40000 ALTER TABLE `notification_templates` DISABLE KEYS */;
INSERT INTO `notification_templates` VALUES ('07107b58-2565-4b97-be4f-756ebb3de39c','ed2de3f5-d5b6-4f00-8549-c1078aba153a','EMAIL','appointment.rescheduled','Tu cita ha sido reagendada','Hola {{clientFirstName}},\n\nTu cita ha sido reagendada.\n\nNueva fecha: {{newDate}}\nNueva hora: {{newTime}}\nServicio(s): {{services}}\nProfesional: {{employeeName}}\n\nSi tienes alguna pregunta, no dudes en contactarnos.',1,'2026-04-02 22:54:29.201','2026-04-02 22:54:29.201'),('11f5ca52-c81f-46e4-ba55-cb886108191b','ed2de3f5-d5b6-4f00-8549-c1078aba153a','WHATSAPP','appointment.created',NULL,'Hola {{clientFirstName}}! Tu cita ha sido agendada para el {{date}} a las {{time}} con {{employeeName}}. Servicio(s): {{services}}. Te esperamos!',1,'2026-04-02 22:54:29.196','2026-04-02 22:54:29.196'),('2de5497f-0a63-414e-912f-3398370f103a','ed2de3f5-d5b6-4f00-8549-c1078aba153a','WHATSAPP','appointment.rescheduled',NULL,'Hola {{clientFirstName}}! Tu cita ha sido reagendada al {{newDate}} a las {{newTime}} con {{employeeName}}. Si tienes preguntas, contactanos.',1,'2026-04-02 22:54:29.203','2026-04-02 22:54:29.203'),('2f2ef732-22f1-4774-8328-5a8ca889c34c','ed2de3f5-d5b6-4f00-8549-c1078aba153a','EMAIL','appointment.completed','Gracias por tu visita','Hola {{clientFirstName}},\n\nGracias por visitarnos.\n\nServicio(s): {{services}}\nProfesional: {{employeeName}}\n\nEsperamos verte pronto.',1,'2026-04-02 22:54:29.207','2026-04-02 22:54:29.207'),('4610050d-8cac-4ed7-ba68-a26b356fe276','ed2de3f5-d5b6-4f00-8549-c1078aba153a','WHATSAPP','appointment.confirmed',NULL,'Hola {{clientFirstName}}! Tu cita del {{date}} a las {{time}} con {{employeeName}} ha sido confirmada. Te esperamos!',1,'2026-04-02 22:54:29.200','2026-04-02 22:54:29.200'),('6f0665d4-79e6-42a2-8f83-1bc753ba4548','ed2de3f5-d5b6-4f00-8549-c1078aba153a','EMAIL','appointment.cancelled','Tu cita ha sido cancelada','Hola {{clientFirstName}},\n\nLamentamos informarte que tu cita del {{date}} a las {{time}} ha sido cancelada.\n\nServicio(s): {{services}}\nProfesional: {{employeeName}}\n\nPuedes reagendar en cualquier momento.',1,'2026-04-02 22:54:29.204','2026-04-02 22:54:29.204'),('889b1059-384b-4076-ba23-ed16d560c9fb','ed2de3f5-d5b6-4f00-8549-c1078aba153a','WHATSAPP','appointment.cancelled',NULL,'Hola {{clientFirstName}}, tu cita del {{date}} a las {{time}} ha sido cancelada. Puedes reagendar en cualquier momento.',1,'2026-04-02 22:54:29.205','2026-04-02 22:54:29.205'),('afe3ab6f-caf8-4755-82d5-f6e62e8c9135','ed2de3f5-d5b6-4f00-8549-c1078aba153a','WHATSAPP','payment.completed',NULL,'Hola {{clientFirstName}}! Pago recibido: ${{amount}} {{currency}} via {{paymentMethod}}. Gracias!',1,'2026-04-02 22:54:29.211','2026-04-02 22:54:29.211'),('b1995b89-41a9-42fe-ba84-dd1a896967e1','ed2de3f5-d5b6-4f00-8549-c1078aba153a','EMAIL','appointment.created','Tu cita ha sido agendada - {{date}}','Hola {{clientFirstName}},\n\nTu cita ha sido agendada exitosamente.\n\nDetalles:\n- Fecha: {{date}}\n- Hora: {{time}}\n- Servicio(s): {{services}}\n- Profesional: {{employeeName}}\n- Total: ${{totalPrice}}\n\nTe esperamos.',1,'2026-04-02 22:54:29.194','2026-04-02 22:54:29.194'),('cd742ae8-e704-4526-9d94-df12c5613e1a','ed2de3f5-d5b6-4f00-8549-c1078aba153a','WHATSAPP','appointment.completed',NULL,'Hola {{clientFirstName}}! Gracias por tu visita. Esperamos que hayas disfrutado tu {{services}} con {{employeeName}}. Te esperamos pronto!',1,'2026-04-02 22:54:29.208','2026-04-02 22:54:29.208'),('da13af7e-8dca-4f6a-a51e-908d1b67d9e7','ed2de3f5-d5b6-4f00-8549-c1078aba153a','EMAIL','appointment.confirmed','Tu cita ha sido confirmada - {{date}}','Hola {{clientFirstName}},\n\nTu cita para el {{date}} a las {{time}} ha sido confirmada.\n\nServicio(s): {{services}}\nProfesional: {{employeeName}}\n\nTe esperamos.',1,'2026-04-02 22:54:29.199','2026-04-02 22:54:29.199'),('f3b78eb5-55fe-409a-84bb-9c39bd21ee81','ed2de3f5-d5b6-4f00-8549-c1078aba153a','EMAIL','payment.completed','Pago recibido - ${{amount}}','Hola {{clientFirstName}},\n\nHemos recibido tu pago.\n\nMonto: ${{amount}} {{currency}}\nMetodo: {{paymentMethod}}\nFecha: {{date}}\n\nGracias.',1,'2026-04-02 22:54:29.210','2026-04-02 22:54:29.210');
/*!40000 ALTER TABLE `notification_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_items`
--

DROP TABLE IF EXISTS `payment_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment_items` (
  `id` varchar(191) NOT NULL,
  `payment_id` varchar(191) NOT NULL,
  `description` varchar(191) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `item_type` enum('SERVICE','PRODUCT','OTHER') NOT NULL,
  `reference_id` varchar(191) DEFAULT NULL,
  `reference_type` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `payment_items_payment_id_idx` (`payment_id`),
  CONSTRAINT `payment_items_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_items`
--

LOCK TABLES `payment_items` WRITE;
/*!40000 ALTER TABLE `payment_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payments` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `appointment_id` varchar(191) DEFAULT NULL,
  `client_id` varchar(191) NOT NULL,
  `location_id` varchar(191) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `tip_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(10,2) NOT NULL,
  `currency` varchar(191) NOT NULL DEFAULT 'USD',
  `payment_method` enum('CASH','CARD','TRANSFER','STRIPE','OTHER') NOT NULL,
  `status` enum('PENDING','COMPLETED','REFUNDED','PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING',
  `reference` varchar(191) DEFAULT NULL,
  `stripe_session_id` varchar(191) DEFAULT NULL,
  `stripe_payment_intent_id` varchar(191) DEFAULT NULL,
  `notes` varchar(191) DEFAULT NULL,
  `created_by` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `payments_tenant_id_idx` (`tenant_id`),
  KEY `payments_appointment_id_idx` (`appointment_id`),
  KEY `payments_client_id_idx` (`client_id`),
  KEY `payments_tenant_id_created_at_idx` (`tenant_id`,`created_at`),
  CONSTRAINT `payments_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payments_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payments_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `id` varchar(191) NOT NULL,
  `module` varchar(191) NOT NULL,
  `action` varchar(191) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_module_action_key` (`module`,`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES ('04ed0907-e406-487d-a7e0-7c255f8ac634','reports','revenue','View revenue reports'),('0a1063c6-32e2-4f6d-85bb-3593ec6633f8','clients','export','Export clients data'),('0e2eebdb-7028-49a0-a13f-06c85c0317e0','automations','update','Update automation rules'),('0fce6253-706f-43c3-84d1-c86f508f2141','settings','integrations','Manage integrations'),('10a38204-9fe9-4a62-94ca-4a72b07d378d','services','read','Read/view services'),('1170d720-f2b9-4913-8ef7-4d0c4fb898eb','appointments','reschedule','Reschedule appointments'),('159fc7c1-ff4c-4fad-91fa-28af77dceb44','resources','read','Read/view resources'),('168cc9f4-1dd3-4ae1-8fca-d06b6076fc6e','automations','execute','Execute automation rules manually'),('18659177-4fdd-4305-b3bb-0c73766b5c73','availability','read','View availability'),('1d86109b-5c64-43e9-9163-bc9d7f412821','locations','read','Read/view locations'),('22f5c3e2-f144-4563-89be-13dbc5920e46','roles','update','Update roles'),('29513581-9c80-476f-bc31-eb81ccb6dfc2','promotions','update','Update promotions'),('325820bb-7ecf-4ffd-996a-715442b97828','appointments','delete','Delete appointments'),('3514eaf9-7dd7-42bd-b9bb-3d8455805152','resources','update','Update resources'),('355a7086-8095-45e6-b1b3-ebdafc0656d2','roles','delete','Delete roles'),('393d48c4-f5b9-4378-b19e-b200118bdf7b','rewards','create','Create rewards'),('3994cce2-97c3-49a9-a0ad-bdec0f2e7549','promotions','create','Create promotions'),('428a5f9d-63af-4591-9290-1791b654e8be','inventory','create','Create products/suppliers'),('526be7a7-d7b9-459a-b2fc-52fcd78bd382','employees','manage_schedule','Manage employee schedules'),('526dd9b4-9007-493e-88a4-e78e0ec9a37a','services','delete','Delete services'),('5314db2d-9bcc-4b73-b409-0d0d70d1b9c1','employees','create','Create employees'),('5391b5ff-1328-4641-b7a9-f47be8177810','rewards','delete','Delete/deactivate rewards'),('573a65e0-7c35-45ca-8d38-f81983ce63f0','roles','read','Read/view roles'),('58160ddc-a142-4f8e-928b-a5206dba7962','users','invite','Invite users'),('5cd8c2b0-f225-4509-bf98-a1b84c13caef','payments','refund','Process refunds'),('621cfacf-b537-47b6-881c-c6145133efc7','clients','delete','Delete clients'),('6265f3bb-8e5f-4b22-b140-6890defd6914','reports','clients','View client reports'),('6387c9f2-d440-4679-868f-6e6036fb321f','users','read','Read/view users'),('677f0ff8-8598-4e22-91bb-341f01a361fc','locations','update','Update locations'),('6b717c87-fcb0-43c7-a1a3-4b16c040404f','users','create','Create users'),('6c958291-126a-46c5-9acb-5fe326ff6570','rewards','update','Update rewards'),('6d4a77a2-8d52-4755-ba58-ef2b6a5b64f3','appointments','read','Read/view appointments'),('6d6734f4-afee-4acf-bdd4-c77d3bd934a5','appointments','update','Update appointments'),('7039df60-317e-4aa9-8edb-de49afbae29f','roles','create','Create roles'),('7bd9d0a0-f9df-4e37-a553-d45aec1d679f','settings','general','Manage general settings'),('7f596e60-a361-4784-bb55-e8a30567e185','automations','create','Create automation rules'),('807ee774-8ac6-4254-adec-0556cb492aa6','inventory','delete','Delete products/suppliers'),('8d9d578c-6368-4da3-af3b-4cb212895893','availability','manage','Manage availability settings'),('9548df3e-a629-4a55-806b-3ea2cd00ea9f','employees','delete','Delete employees'),('954e9d7c-90fe-4366-8168-d112aca7a5ff','rewards','read','Read/view rewards'),('97458f5e-28ba-409e-b955-4d797ce10f57','appointments','cancel','Cancel appointments'),('9b25d3a6-706a-4eab-93b8-45534f666528','clients','update','Update clients'),('9ec10e0f-b34b-449d-97b7-462f9c474ab0','locations','delete','Delete locations'),('a19eef18-d1ab-4b65-857e-e1bee6aace0d','employees','update','Update employees'),('a20cf14d-0ba0-4986-a87c-37922ad879ab','settings','billing','Manage billing settings'),('a3d5858a-8bcf-4a0d-b668-7f54a3f6bcb1','locations','create','Create locations'),('ad887f3e-2b39-4c9c-95d5-c947b8d04d02','employees','manage_time_off','Manage employee time off'),('b036f361-bba9-4fe5-93a6-323c343d692d','appointments','complete','Mark appointments as complete'),('b462b9a5-17d6-4f29-8a34-8b390c3e105b','promotions','delete','Delete promotions'),('b7181039-9992-467e-a26c-a9f4e4d28088','users','update','Update users'),('b727d44f-2128-400e-8294-cbb01193f490','automations','read','Read/view automation rules'),('b8296f88-2eff-4b12-8429-0b5517894935','resources','create','Create resources'),('b89ffce5-c236-4b07-8a56-53d8e17fd57f','services','create','Create services'),('b99e7ab9-8657-454a-9eed-d053492837ea','reports','appointments','View appointment reports'),('bedf9bde-5c1b-428d-bdc6-d2df261c5eac','reports','staff','View staff reports'),('c123d6ae-1f03-4d55-b87d-a3ca3dd71f67','audit','read','Read audit logs'),('c233e89a-b4c3-4153-998b-b9ce46847f13','payments','read','Read/view payments'),('c788f9dc-6289-4251-a843-85f242d68b39','clients','read','Read/view clients'),('ca6d90cb-cc15-4214-a0f3-8743d30d49d3','payments','create','Create payments'),('cb4029ab-d4f3-4a9f-b418-d250c3fad625','inventory','update','Update products/suppliers'),('cb61037b-4626-4e30-a3f4-fd6ec253fffd','users','delete','Delete users'),('cc61c5bf-5076-46f7-ac30-6dc35157fd26','employees','manage_services','Manage employee services and commissions'),('cd158363-126d-442e-bf4e-f2cb9e4aa7c2','promotions','read','Read/view promotions'),('d4fc2adc-b63f-4e77-beae-df6a33deebc3','automations','delete','Delete automation rules'),('d537fd79-0b0a-40b0-a4f2-a641ac2db3e9','notifications','manage','Manage notification templates'),('d7cb1718-4ef5-41e1-973e-03bbcd25b3e3','tenant','read','View tenant/business settings'),('d9239e7d-c8fd-4ac7-b78f-bbff5da24e5d','payments','export','Export payment data'),('e0d164ef-2e4c-43b5-9006-5bb96a6a8196','employees','read','Read/view employees'),('e8e70b1c-bde6-4932-86ae-e879ffd265c9','inventory','read','Read/view inventory'),('e9b246f4-b66d-4bbd-8ec1-e063941b4339','resources','delete','Delete resources'),('f006e605-3cf5-4b0b-b082-fe74cea03d78','tenant','update','Update tenant/business settings'),('f041f708-0b05-4f3b-9ba9-7fd73f285ecf','services','update','Update services'),('f10d1467-bf54-4bf6-bea4-12aea868d91e','clients','create','Create clients'),('fde705a9-ed0c-4265-8501-227b2588b8ca','appointments','create','Create appointments');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platform_refresh_tokens`
--

DROP TABLE IF EXISTS `platform_refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `platform_refresh_tokens` (
  `id` varchar(191) NOT NULL,
  `user_id` varchar(191) NOT NULL,
  `token_hash` varchar(191) NOT NULL,
  `token_hint` varchar(191) NOT NULL DEFAULT '',
  `expires_at` datetime(3) NOT NULL,
  `revoked_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `platform_refresh_tokens_token_hint_idx` (`token_hint`),
  KEY `platform_refresh_tokens_user_id_idx` (`user_id`),
  CONSTRAINT `platform_refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `platform_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platform_refresh_tokens`
--

LOCK TABLES `platform_refresh_tokens` WRITE;
/*!40000 ALTER TABLE `platform_refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `platform_refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platform_users`
--

DROP TABLE IF EXISTS `platform_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `platform_users` (
  `id` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password_hash` varchar(191) NOT NULL,
  `first_name` varchar(191) NOT NULL,
  `last_name` varchar(191) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platform_users_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platform_users`
--

LOCK TABLES `platform_users` WRITE;
/*!40000 ALTER TABLE `platform_users` DISABLE KEYS */;
INSERT INTO `platform_users` VALUES ('fcc2fc8b-e2fe-49af-9a67-76a756f11b89','super@siliba.com','$2b$12$A6okGlVtIpMVKfQt3kD2POtHssmNa/ECLIxGx/433y0Cv5UZAi5RG','Super','Admin',1,NULL,'2026-04-02 22:54:29.175','2026-04-02 22:54:29.175');
/*!40000 ALTER TABLE `platform_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `sku` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(191) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `min_stock` int(11) NOT NULL DEFAULT 0,
  `unit` varchar(50) NOT NULL DEFAULT 'unidad',
  `supplier_id` varchar(191) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `products_tenant_id_idx` (`tenant_id`),
  KEY `products_tenant_id_is_active_idx` (`tenant_id`,`is_active`),
  KEY `products_supplier_id_idx` (`supplier_id`),
  CONSTRAINT `products_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `products_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `professions`
--

DROP TABLE IF EXISTS `professions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `professions` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `professions_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `professions`
--

LOCK TABLES `professions` WRITE;
/*!40000 ALTER TABLE `professions` DISABLE KEYS */;
INSERT INTO `professions` VALUES ('5aac9e13-2ee7-11f1-baee-00a741030a54','Barbero/a',1,0,'2026-04-02 16:57:25.000'),('5aacafe9-2ee7-11f1-baee-00a741030a54','Colorista',1,0,'2026-04-02 16:57:25.000'),('5aacb013-2ee7-11f1-baee-00a741030a54','Cosmetólogo/a',1,0,'2026-04-02 16:57:25.000'),('5aacb029-2ee7-11f1-baee-00a741030a54','Esteticista',1,0,'2026-04-02 16:57:25.000'),('5aacb03c-2ee7-11f1-baee-00a741030a54','Estilista',1,0,'2026-04-02 16:57:25.000'),('5aacb04f-2ee7-11f1-baee-00a741030a54','Manicurista',1,0,'2026-04-02 16:57:25.000'),('5aacb062-2ee7-11f1-baee-00a741030a54','Masajista',1,0,'2026-04-02 16:57:25.000'),('5aacb073-2ee7-11f1-baee-00a741030a54','Pedicurista',1,0,'2026-04-02 16:57:25.000'),('5aacb086-2ee7-11f1-baee-00a741030a54','Piercer',1,0,'2026-04-02 16:57:25.000'),('5aacb098-2ee7-11f1-baee-00a741030a54','Tatuador/a',1,0,'2026-04-02 16:57:25.000'),('5aacb0aa-2ee7-11f1-baee-00a741030a54','Terapeuta',1,0,'2026-04-02 16:57:25.000');
/*!40000 ALTER TABLE `professions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promotions`
--

DROP TABLE IF EXISTS `promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `promotions` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `type` varchar(191) NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `start_date` datetime(3) NOT NULL,
  `end_date` datetime(3) NOT NULL,
  `max_uses` int(11) DEFAULT NULL,
  `used_count` int(11) NOT NULL DEFAULT 0,
  `service_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`service_ids`)),
  `min_amount` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `promotions_tenant_id_is_active_idx` (`tenant_id`,`is_active`),
  KEY `promotions_code_idx` (`code`),
  CONSTRAINT `promotions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promotions`
--

LOCK TABLES `promotions` WRITE;
/*!40000 ALTER TABLE `promotions` DISABLE KEYS */;
/*!40000 ALTER TABLE `promotions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `refresh_tokens` (
  `id` varchar(191) NOT NULL,
  `user_id` varchar(191) NOT NULL,
  `token_hash` varchar(191) NOT NULL,
  `token_hint` varchar(191) NOT NULL DEFAULT '',
  `expires_at` datetime(3) NOT NULL,
  `revoked_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `refresh_tokens_token_hint_idx` (`token_hint`),
  KEY `refresh_tokens_user_id_idx` (`user_id`),
  CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resources`
--

DROP TABLE IF EXISTS `resources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `resources` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `location_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `type` varchar(191) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `resources_tenant_id_location_id_idx` (`tenant_id`,`location_id`),
  KEY `resources_location_id_fkey` (`location_id`),
  CONSTRAINT `resources_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `resources_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resources`
--

LOCK TABLES `resources` WRITE;
/*!40000 ALTER TABLE `resources` DISABLE KEYS */;
/*!40000 ALTER TABLE `resources` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reward_redemptions`
--

DROP TABLE IF EXISTS `reward_redemptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reward_redemptions` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `reward_id` varchar(191) NOT NULL,
  `client_id` varchar(191) NOT NULL,
  `points_spent` int(11) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'ACTIVE',
  `code` varchar(12) NOT NULL,
  `expires_at` datetime(3) DEFAULT NULL,
  `used_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `reward_redemptions_code_key` (`code`),
  KEY `reward_redemptions_tenant_id_idx` (`tenant_id`),
  KEY `reward_redemptions_client_id_idx` (`client_id`),
  KEY `reward_redemptions_code_idx` (`code`),
  KEY `reward_redemptions_reward_id_fkey` (`reward_id`),
  CONSTRAINT `reward_redemptions_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `reward_redemptions_reward_id_fkey` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `reward_redemptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reward_redemptions`
--

LOCK TABLES `reward_redemptions` WRITE;
/*!40000 ALTER TABLE `reward_redemptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `reward_redemptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rewards`
--

DROP TABLE IF EXISTS `rewards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rewards` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `type` varchar(191) NOT NULL,
  `points_required` int(11) NOT NULL,
  `service_id` varchar(191) DEFAULT NULL,
  `discount_amount` decimal(10,2) DEFAULT NULL,
  `discount_mode` varchar(191) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `max_redemptions` int(11) DEFAULT NULL,
  `times_redeemed` int(11) NOT NULL DEFAULT 0,
  `valid_until` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `rewards_tenant_id_is_active_idx` (`tenant_id`,`is_active`),
  KEY `rewards_service_id_fkey` (`service_id`),
  CONSTRAINT `rewards_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `rewards_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rewards`
--

LOCK TABLES `rewards` WRITE;
/*!40000 ALTER TABLE `rewards` DISABLE KEYS */;
INSERT INTO `rewards` VALUES ('61c7fe97-da08-4647-9655-10227c774fb8','ed2de3f5-d5b6-4f00-8549-c1078aba153a','10% de Descuento','Obtén un 10% de descuento en cualquier servicio.','DESCUENTO',200,NULL,10.00,'PERCENTAGE',1,NULL,0,NULL,'2026-04-02 22:54:29.592','2026-04-02 22:54:29.592'),('d64cc9fd-34d5-4474-8928-93200345e888','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Corte Gratis','Canjea tus puntos por un corte de cabello completamente gratis.','SERVICIO',500,'094d585d-29ed-489a-8230-23d5c9c50cf5',NULL,NULL,1,NULL,0,NULL,'2026-04-02 22:54:29.590','2026-04-02 22:54:29.590');
/*!40000 ALTER TABLE `rewards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_permissions` (
  `role_id` varchar(191) NOT NULL,
  `permission_id` varchar(191) NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `role_permissions_permission_id_fkey` (`permission_id`),
  CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES ('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','04ed0907-e406-487d-a7e0-7c255f8ac634'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','0a1063c6-32e2-4f6d-85bb-3593ec6633f8'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','0e2eebdb-7028-49a0-a13f-06c85c0317e0'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','0fce6253-706f-43c3-84d1-c86f508f2141'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','10a38204-9fe9-4a62-94ca-4a72b07d378d'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','1170d720-f2b9-4913-8ef7-4d0c4fb898eb'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','159fc7c1-ff4c-4fad-91fa-28af77dceb44'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','168cc9f4-1dd3-4ae1-8fca-d06b6076fc6e'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','18659177-4fdd-4305-b3bb-0c73766b5c73'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','1d86109b-5c64-43e9-9163-bc9d7f412821'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','22f5c3e2-f144-4563-89be-13dbc5920e46'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','29513581-9c80-476f-bc31-eb81ccb6dfc2'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','325820bb-7ecf-4ffd-996a-715442b97828'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','3514eaf9-7dd7-42bd-b9bb-3d8455805152'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','355a7086-8095-45e6-b1b3-ebdafc0656d2'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','393d48c4-f5b9-4378-b19e-b200118bdf7b'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','3994cce2-97c3-49a9-a0ad-bdec0f2e7549'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','428a5f9d-63af-4591-9290-1791b654e8be'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','526be7a7-d7b9-459a-b2fc-52fcd78bd382'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','526dd9b4-9007-493e-88a4-e78e0ec9a37a'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','5314db2d-9bcc-4b73-b409-0d0d70d1b9c1'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','5391b5ff-1328-4641-b7a9-f47be8177810'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','573a65e0-7c35-45ca-8d38-f81983ce63f0'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','58160ddc-a142-4f8e-928b-a5206dba7962'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','5cd8c2b0-f225-4509-bf98-a1b84c13caef'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','621cfacf-b537-47b6-881c-c6145133efc7'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','6265f3bb-8e5f-4b22-b140-6890defd6914'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','6387c9f2-d440-4679-868f-6e6036fb321f'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','677f0ff8-8598-4e22-91bb-341f01a361fc'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','6b717c87-fcb0-43c7-a1a3-4b16c040404f'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','6c958291-126a-46c5-9acb-5fe326ff6570'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','6d4a77a2-8d52-4755-ba58-ef2b6a5b64f3'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','6d6734f4-afee-4acf-bdd4-c77d3bd934a5'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','7039df60-317e-4aa9-8edb-de49afbae29f'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','7bd9d0a0-f9df-4e37-a553-d45aec1d679f'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','7f596e60-a361-4784-bb55-e8a30567e185'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','807ee774-8ac6-4254-adec-0556cb492aa6'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','8d9d578c-6368-4da3-af3b-4cb212895893'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','9548df3e-a629-4a55-806b-3ea2cd00ea9f'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','954e9d7c-90fe-4366-8168-d112aca7a5ff'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','97458f5e-28ba-409e-b955-4d797ce10f57'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','9b25d3a6-706a-4eab-93b8-45534f666528'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','9ec10e0f-b34b-449d-97b7-462f9c474ab0'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','a19eef18-d1ab-4b65-857e-e1bee6aace0d'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','a3d5858a-8bcf-4a0d-b668-7f54a3f6bcb1'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','ad887f3e-2b39-4c9c-95d5-c947b8d04d02'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','b036f361-bba9-4fe5-93a6-323c343d692d'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','b462b9a5-17d6-4f29-8a34-8b390c3e105b'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','b7181039-9992-467e-a26c-a9f4e4d28088'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','b727d44f-2128-400e-8294-cbb01193f490'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','b8296f88-2eff-4b12-8429-0b5517894935'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','b89ffce5-c236-4b07-8a56-53d8e17fd57f'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','b99e7ab9-8657-454a-9eed-d053492837ea'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','bedf9bde-5c1b-428d-bdc6-d2df261c5eac'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','c123d6ae-1f03-4d55-b87d-a3ca3dd71f67'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','c233e89a-b4c3-4153-998b-b9ce46847f13'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','c788f9dc-6289-4251-a843-85f242d68b39'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','ca6d90cb-cc15-4214-a0f3-8743d30d49d3'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','cb4029ab-d4f3-4a9f-b418-d250c3fad625'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','cb61037b-4626-4e30-a3f4-fd6ec253fffd'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','cc61c5bf-5076-46f7-ac30-6dc35157fd26'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','cd158363-126d-442e-bf4e-f2cb9e4aa7c2'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','d4fc2adc-b63f-4e77-beae-df6a33deebc3'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','d537fd79-0b0a-40b0-a4f2-a641ac2db3e9'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','d7cb1718-4ef5-41e1-973e-03bbcd25b3e3'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','d9239e7d-c8fd-4ac7-b78f-bbff5da24e5d'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','e0d164ef-2e4c-43b5-9006-5bb96a6a8196'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','e8e70b1c-bde6-4932-86ae-e879ffd265c9'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','e9b246f4-b66d-4bbd-8ec1-e063941b4339'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','f006e605-3cf5-4b0b-b082-fe74cea03d78'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','f041f708-0b05-4f3b-9ba9-7fd73f285ecf'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','f10d1467-bf54-4bf6-bea4-12aea868d91e'),('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','fde705a9-ed0c-4265-8501-227b2588b8ca'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','04ed0907-e406-487d-a7e0-7c255f8ac634'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','0a1063c6-32e2-4f6d-85bb-3593ec6633f8'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','10a38204-9fe9-4a62-94ca-4a72b07d378d'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','1d86109b-5c64-43e9-9163-bc9d7f412821'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','6265f3bb-8e5f-4b22-b140-6890defd6914'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','6d4a77a2-8d52-4755-ba58-ef2b6a5b64f3'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','954e9d7c-90fe-4366-8168-d112aca7a5ff'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','b99e7ab9-8657-454a-9eed-d053492837ea'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','bedf9bde-5c1b-428d-bdc6-d2df261c5eac'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','c233e89a-b4c3-4153-998b-b9ce46847f13'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','c788f9dc-6289-4251-a843-85f242d68b39'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','cd158363-126d-442e-bf4e-f2cb9e4aa7c2'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','d9239e7d-c8fd-4ac7-b78f-bbff5da24e5d'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','e0d164ef-2e4c-43b5-9006-5bb96a6a8196'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','e8e70b1c-bde6-4932-86ae-e879ffd265c9'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','10a38204-9fe9-4a62-94ca-4a72b07d378d'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','159fc7c1-ff4c-4fad-91fa-28af77dceb44'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','18659177-4fdd-4305-b3bb-0c73766b5c73'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','1d86109b-5c64-43e9-9163-bc9d7f412821'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','6d4a77a2-8d52-4755-ba58-ef2b6a5b64f3'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','954e9d7c-90fe-4366-8168-d112aca7a5ff'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','b036f361-bba9-4fe5-93a6-323c343d692d'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','c788f9dc-6289-4251-a843-85f242d68b39'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','e0d164ef-2e4c-43b5-9006-5bb96a6a8196'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','04ed0907-e406-487d-a7e0-7c255f8ac634'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','10a38204-9fe9-4a62-94ca-4a72b07d378d'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','159fc7c1-ff4c-4fad-91fa-28af77dceb44'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','18659177-4fdd-4305-b3bb-0c73766b5c73'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','1d86109b-5c64-43e9-9163-bc9d7f412821'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','573a65e0-7c35-45ca-8d38-f81983ce63f0'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','6265f3bb-8e5f-4b22-b140-6890defd6914'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','6d4a77a2-8d52-4755-ba58-ef2b6a5b64f3'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','954e9d7c-90fe-4366-8168-d112aca7a5ff'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','b99e7ab9-8657-454a-9eed-d053492837ea'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','bedf9bde-5c1b-428d-bdc6-d2df261c5eac'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','c233e89a-b4c3-4153-998b-b9ce46847f13'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','c788f9dc-6289-4251-a843-85f242d68b39'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','cd158363-126d-442e-bf4e-f2cb9e4aa7c2'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','d7cb1718-4ef5-41e1-973e-03bbcd25b3e3'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','e0d164ef-2e4c-43b5-9006-5bb96a6a8196'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','e8e70b1c-bde6-4932-86ae-e879ffd265c9'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','10a38204-9fe9-4a62-94ca-4a72b07d378d'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','1170d720-f2b9-4913-8ef7-4d0c4fb898eb'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','159fc7c1-ff4c-4fad-91fa-28af77dceb44'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','18659177-4fdd-4305-b3bb-0c73766b5c73'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','1d86109b-5c64-43e9-9163-bc9d7f412821'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','6d4a77a2-8d52-4755-ba58-ef2b6a5b64f3'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','6d6734f4-afee-4acf-bdd4-c77d3bd934a5'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','954e9d7c-90fe-4366-8168-d112aca7a5ff'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','97458f5e-28ba-409e-b955-4d797ce10f57'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','9b25d3a6-706a-4eab-93b8-45534f666528'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','b036f361-bba9-4fe5-93a6-323c343d692d'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','b99e7ab9-8657-454a-9eed-d053492837ea'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','c233e89a-b4c3-4153-998b-b9ce46847f13'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','c788f9dc-6289-4251-a843-85f242d68b39'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','ca6d90cb-cc15-4214-a0f3-8743d30d49d3'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','cd158363-126d-442e-bf4e-f2cb9e4aa7c2'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','e0d164ef-2e4c-43b5-9006-5bb96a6a8196'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','f10d1467-bf54-4bf6-bea4-12aea868d91e'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','fde705a9-ed0c-4265-8501-227b2588b8ca'),('89723ac8-e892-4782-be6b-76e8a550df42','04ed0907-e406-487d-a7e0-7c255f8ac634'),('89723ac8-e892-4782-be6b-76e8a550df42','0a1063c6-32e2-4f6d-85bb-3593ec6633f8'),('89723ac8-e892-4782-be6b-76e8a550df42','0e2eebdb-7028-49a0-a13f-06c85c0317e0'),('89723ac8-e892-4782-be6b-76e8a550df42','10a38204-9fe9-4a62-94ca-4a72b07d378d'),('89723ac8-e892-4782-be6b-76e8a550df42','1170d720-f2b9-4913-8ef7-4d0c4fb898eb'),('89723ac8-e892-4782-be6b-76e8a550df42','159fc7c1-ff4c-4fad-91fa-28af77dceb44'),('89723ac8-e892-4782-be6b-76e8a550df42','18659177-4fdd-4305-b3bb-0c73766b5c73'),('89723ac8-e892-4782-be6b-76e8a550df42','1d86109b-5c64-43e9-9163-bc9d7f412821'),('89723ac8-e892-4782-be6b-76e8a550df42','29513581-9c80-476f-bc31-eb81ccb6dfc2'),('89723ac8-e892-4782-be6b-76e8a550df42','3514eaf9-7dd7-42bd-b9bb-3d8455805152'),('89723ac8-e892-4782-be6b-76e8a550df42','393d48c4-f5b9-4378-b19e-b200118bdf7b'),('89723ac8-e892-4782-be6b-76e8a550df42','3994cce2-97c3-49a9-a0ad-bdec0f2e7549'),('89723ac8-e892-4782-be6b-76e8a550df42','428a5f9d-63af-4591-9290-1791b654e8be'),('89723ac8-e892-4782-be6b-76e8a550df42','526be7a7-d7b9-459a-b2fc-52fcd78bd382'),('89723ac8-e892-4782-be6b-76e8a550df42','5314db2d-9bcc-4b73-b409-0d0d70d1b9c1'),('89723ac8-e892-4782-be6b-76e8a550df42','573a65e0-7c35-45ca-8d38-f81983ce63f0'),('89723ac8-e892-4782-be6b-76e8a550df42','5cd8c2b0-f225-4509-bf98-a1b84c13caef'),('89723ac8-e892-4782-be6b-76e8a550df42','6265f3bb-8e5f-4b22-b140-6890defd6914'),('89723ac8-e892-4782-be6b-76e8a550df42','6387c9f2-d440-4679-868f-6e6036fb321f'),('89723ac8-e892-4782-be6b-76e8a550df42','6c958291-126a-46c5-9acb-5fe326ff6570'),('89723ac8-e892-4782-be6b-76e8a550df42','6d4a77a2-8d52-4755-ba58-ef2b6a5b64f3'),('89723ac8-e892-4782-be6b-76e8a550df42','6d6734f4-afee-4acf-bdd4-c77d3bd934a5'),('89723ac8-e892-4782-be6b-76e8a550df42','7f596e60-a361-4784-bb55-e8a30567e185'),('89723ac8-e892-4782-be6b-76e8a550df42','8d9d578c-6368-4da3-af3b-4cb212895893'),('89723ac8-e892-4782-be6b-76e8a550df42','954e9d7c-90fe-4366-8168-d112aca7a5ff'),('89723ac8-e892-4782-be6b-76e8a550df42','97458f5e-28ba-409e-b955-4d797ce10f57'),('89723ac8-e892-4782-be6b-76e8a550df42','9b25d3a6-706a-4eab-93b8-45534f666528'),('89723ac8-e892-4782-be6b-76e8a550df42','a19eef18-d1ab-4b65-857e-e1bee6aace0d'),('89723ac8-e892-4782-be6b-76e8a550df42','ad887f3e-2b39-4c9c-95d5-c947b8d04d02'),('89723ac8-e892-4782-be6b-76e8a550df42','b036f361-bba9-4fe5-93a6-323c343d692d'),('89723ac8-e892-4782-be6b-76e8a550df42','b727d44f-2128-400e-8294-cbb01193f490'),('89723ac8-e892-4782-be6b-76e8a550df42','b8296f88-2eff-4b12-8429-0b5517894935'),('89723ac8-e892-4782-be6b-76e8a550df42','b89ffce5-c236-4b07-8a56-53d8e17fd57f'),('89723ac8-e892-4782-be6b-76e8a550df42','b99e7ab9-8657-454a-9eed-d053492837ea'),('89723ac8-e892-4782-be6b-76e8a550df42','bedf9bde-5c1b-428d-bdc6-d2df261c5eac'),('89723ac8-e892-4782-be6b-76e8a550df42','c233e89a-b4c3-4153-998b-b9ce46847f13'),('89723ac8-e892-4782-be6b-76e8a550df42','c788f9dc-6289-4251-a843-85f242d68b39'),('89723ac8-e892-4782-be6b-76e8a550df42','ca6d90cb-cc15-4214-a0f3-8743d30d49d3'),('89723ac8-e892-4782-be6b-76e8a550df42','cb4029ab-d4f3-4a9f-b418-d250c3fad625'),('89723ac8-e892-4782-be6b-76e8a550df42','cc61c5bf-5076-46f7-ac30-6dc35157fd26'),('89723ac8-e892-4782-be6b-76e8a550df42','cd158363-126d-442e-bf4e-f2cb9e4aa7c2'),('89723ac8-e892-4782-be6b-76e8a550df42','d537fd79-0b0a-40b0-a4f2-a641ac2db3e9'),('89723ac8-e892-4782-be6b-76e8a550df42','d7cb1718-4ef5-41e1-973e-03bbcd25b3e3'),('89723ac8-e892-4782-be6b-76e8a550df42','d9239e7d-c8fd-4ac7-b78f-bbff5da24e5d'),('89723ac8-e892-4782-be6b-76e8a550df42','e0d164ef-2e4c-43b5-9006-5bb96a6a8196'),('89723ac8-e892-4782-be6b-76e8a550df42','e8e70b1c-bde6-4932-86ae-e879ffd265c9'),('89723ac8-e892-4782-be6b-76e8a550df42','f041f708-0b05-4f3b-9ba9-7fd73f285ecf'),('89723ac8-e892-4782-be6b-76e8a550df42','f10d1467-bf54-4bf6-bea4-12aea868d91e'),('89723ac8-e892-4782-be6b-76e8a550df42','fde705a9-ed0c-4265-8501-227b2588b8ca'),('f2fafdef-8f90-4927-9999-08be11dd1e72','04ed0907-e406-487d-a7e0-7c255f8ac634'),('f2fafdef-8f90-4927-9999-08be11dd1e72','0a1063c6-32e2-4f6d-85bb-3593ec6633f8'),('f2fafdef-8f90-4927-9999-08be11dd1e72','0e2eebdb-7028-49a0-a13f-06c85c0317e0'),('f2fafdef-8f90-4927-9999-08be11dd1e72','0fce6253-706f-43c3-84d1-c86f508f2141'),('f2fafdef-8f90-4927-9999-08be11dd1e72','10a38204-9fe9-4a62-94ca-4a72b07d378d'),('f2fafdef-8f90-4927-9999-08be11dd1e72','1170d720-f2b9-4913-8ef7-4d0c4fb898eb'),('f2fafdef-8f90-4927-9999-08be11dd1e72','159fc7c1-ff4c-4fad-91fa-28af77dceb44'),('f2fafdef-8f90-4927-9999-08be11dd1e72','168cc9f4-1dd3-4ae1-8fca-d06b6076fc6e'),('f2fafdef-8f90-4927-9999-08be11dd1e72','18659177-4fdd-4305-b3bb-0c73766b5c73'),('f2fafdef-8f90-4927-9999-08be11dd1e72','1d86109b-5c64-43e9-9163-bc9d7f412821'),('f2fafdef-8f90-4927-9999-08be11dd1e72','22f5c3e2-f144-4563-89be-13dbc5920e46'),('f2fafdef-8f90-4927-9999-08be11dd1e72','29513581-9c80-476f-bc31-eb81ccb6dfc2'),('f2fafdef-8f90-4927-9999-08be11dd1e72','325820bb-7ecf-4ffd-996a-715442b97828'),('f2fafdef-8f90-4927-9999-08be11dd1e72','3514eaf9-7dd7-42bd-b9bb-3d8455805152'),('f2fafdef-8f90-4927-9999-08be11dd1e72','355a7086-8095-45e6-b1b3-ebdafc0656d2'),('f2fafdef-8f90-4927-9999-08be11dd1e72','393d48c4-f5b9-4378-b19e-b200118bdf7b'),('f2fafdef-8f90-4927-9999-08be11dd1e72','3994cce2-97c3-49a9-a0ad-bdec0f2e7549'),('f2fafdef-8f90-4927-9999-08be11dd1e72','428a5f9d-63af-4591-9290-1791b654e8be'),('f2fafdef-8f90-4927-9999-08be11dd1e72','526be7a7-d7b9-459a-b2fc-52fcd78bd382'),('f2fafdef-8f90-4927-9999-08be11dd1e72','526dd9b4-9007-493e-88a4-e78e0ec9a37a'),('f2fafdef-8f90-4927-9999-08be11dd1e72','5314db2d-9bcc-4b73-b409-0d0d70d1b9c1'),('f2fafdef-8f90-4927-9999-08be11dd1e72','5391b5ff-1328-4641-b7a9-f47be8177810'),('f2fafdef-8f90-4927-9999-08be11dd1e72','573a65e0-7c35-45ca-8d38-f81983ce63f0'),('f2fafdef-8f90-4927-9999-08be11dd1e72','58160ddc-a142-4f8e-928b-a5206dba7962'),('f2fafdef-8f90-4927-9999-08be11dd1e72','5cd8c2b0-f225-4509-bf98-a1b84c13caef'),('f2fafdef-8f90-4927-9999-08be11dd1e72','621cfacf-b537-47b6-881c-c6145133efc7'),('f2fafdef-8f90-4927-9999-08be11dd1e72','6265f3bb-8e5f-4b22-b140-6890defd6914'),('f2fafdef-8f90-4927-9999-08be11dd1e72','6387c9f2-d440-4679-868f-6e6036fb321f'),('f2fafdef-8f90-4927-9999-08be11dd1e72','677f0ff8-8598-4e22-91bb-341f01a361fc'),('f2fafdef-8f90-4927-9999-08be11dd1e72','6b717c87-fcb0-43c7-a1a3-4b16c040404f'),('f2fafdef-8f90-4927-9999-08be11dd1e72','6c958291-126a-46c5-9acb-5fe326ff6570'),('f2fafdef-8f90-4927-9999-08be11dd1e72','6d4a77a2-8d52-4755-ba58-ef2b6a5b64f3'),('f2fafdef-8f90-4927-9999-08be11dd1e72','6d6734f4-afee-4acf-bdd4-c77d3bd934a5'),('f2fafdef-8f90-4927-9999-08be11dd1e72','7039df60-317e-4aa9-8edb-de49afbae29f'),('f2fafdef-8f90-4927-9999-08be11dd1e72','7bd9d0a0-f9df-4e37-a553-d45aec1d679f'),('f2fafdef-8f90-4927-9999-08be11dd1e72','7f596e60-a361-4784-bb55-e8a30567e185'),('f2fafdef-8f90-4927-9999-08be11dd1e72','807ee774-8ac6-4254-adec-0556cb492aa6'),('f2fafdef-8f90-4927-9999-08be11dd1e72','8d9d578c-6368-4da3-af3b-4cb212895893'),('f2fafdef-8f90-4927-9999-08be11dd1e72','9548df3e-a629-4a55-806b-3ea2cd00ea9f'),('f2fafdef-8f90-4927-9999-08be11dd1e72','954e9d7c-90fe-4366-8168-d112aca7a5ff'),('f2fafdef-8f90-4927-9999-08be11dd1e72','97458f5e-28ba-409e-b955-4d797ce10f57'),('f2fafdef-8f90-4927-9999-08be11dd1e72','9b25d3a6-706a-4eab-93b8-45534f666528'),('f2fafdef-8f90-4927-9999-08be11dd1e72','9ec10e0f-b34b-449d-97b7-462f9c474ab0'),('f2fafdef-8f90-4927-9999-08be11dd1e72','a19eef18-d1ab-4b65-857e-e1bee6aace0d'),('f2fafdef-8f90-4927-9999-08be11dd1e72','a20cf14d-0ba0-4986-a87c-37922ad879ab'),('f2fafdef-8f90-4927-9999-08be11dd1e72','a3d5858a-8bcf-4a0d-b668-7f54a3f6bcb1'),('f2fafdef-8f90-4927-9999-08be11dd1e72','ad887f3e-2b39-4c9c-95d5-c947b8d04d02'),('f2fafdef-8f90-4927-9999-08be11dd1e72','b036f361-bba9-4fe5-93a6-323c343d692d'),('f2fafdef-8f90-4927-9999-08be11dd1e72','b462b9a5-17d6-4f29-8a34-8b390c3e105b'),('f2fafdef-8f90-4927-9999-08be11dd1e72','b7181039-9992-467e-a26c-a9f4e4d28088'),('f2fafdef-8f90-4927-9999-08be11dd1e72','b727d44f-2128-400e-8294-cbb01193f490'),('f2fafdef-8f90-4927-9999-08be11dd1e72','b8296f88-2eff-4b12-8429-0b5517894935'),('f2fafdef-8f90-4927-9999-08be11dd1e72','b89ffce5-c236-4b07-8a56-53d8e17fd57f'),('f2fafdef-8f90-4927-9999-08be11dd1e72','b99e7ab9-8657-454a-9eed-d053492837ea'),('f2fafdef-8f90-4927-9999-08be11dd1e72','bedf9bde-5c1b-428d-bdc6-d2df261c5eac'),('f2fafdef-8f90-4927-9999-08be11dd1e72','c123d6ae-1f03-4d55-b87d-a3ca3dd71f67'),('f2fafdef-8f90-4927-9999-08be11dd1e72','c233e89a-b4c3-4153-998b-b9ce46847f13'),('f2fafdef-8f90-4927-9999-08be11dd1e72','c788f9dc-6289-4251-a843-85f242d68b39'),('f2fafdef-8f90-4927-9999-08be11dd1e72','ca6d90cb-cc15-4214-a0f3-8743d30d49d3'),('f2fafdef-8f90-4927-9999-08be11dd1e72','cb4029ab-d4f3-4a9f-b418-d250c3fad625'),('f2fafdef-8f90-4927-9999-08be11dd1e72','cb61037b-4626-4e30-a3f4-fd6ec253fffd'),('f2fafdef-8f90-4927-9999-08be11dd1e72','cc61c5bf-5076-46f7-ac30-6dc35157fd26'),('f2fafdef-8f90-4927-9999-08be11dd1e72','cd158363-126d-442e-bf4e-f2cb9e4aa7c2'),('f2fafdef-8f90-4927-9999-08be11dd1e72','d4fc2adc-b63f-4e77-beae-df6a33deebc3'),('f2fafdef-8f90-4927-9999-08be11dd1e72','d537fd79-0b0a-40b0-a4f2-a641ac2db3e9'),('f2fafdef-8f90-4927-9999-08be11dd1e72','d7cb1718-4ef5-41e1-973e-03bbcd25b3e3'),('f2fafdef-8f90-4927-9999-08be11dd1e72','d9239e7d-c8fd-4ac7-b78f-bbff5da24e5d'),('f2fafdef-8f90-4927-9999-08be11dd1e72','e0d164ef-2e4c-43b5-9006-5bb96a6a8196'),('f2fafdef-8f90-4927-9999-08be11dd1e72','e8e70b1c-bde6-4932-86ae-e879ffd265c9'),('f2fafdef-8f90-4927-9999-08be11dd1e72','e9b246f4-b66d-4bbd-8ec1-e063941b4339'),('f2fafdef-8f90-4927-9999-08be11dd1e72','f006e605-3cf5-4b0b-b082-fe74cea03d78'),('f2fafdef-8f90-4927-9999-08be11dd1e72','f041f708-0b05-4f3b-9ba9-7fd73f285ecf'),('f2fafdef-8f90-4927-9999-08be11dd1e72','f10d1467-bf54-4bf6-bea4-12aea868d91e'),('f2fafdef-8f90-4927-9999-08be11dd1e72','fde705a9-ed0c-4265-8501-227b2588b8ca');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_tenant_id_slug_key` (`tenant_id`,`slug`),
  KEY `roles_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `roles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES ('1dcd4e54-7507-4d2a-8a13-4297280d3bb2','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Admin','admin','Administrador — acceso total excepto facturacion. Puede gestionar roles, usuarios y configuracion',1,'2026-04-02 22:54:28.395','2026-04-02 22:56:22.918'),('3c8ead09-bf8a-41d8-b659-618ffa7c577f','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Contador','accountant','Contador — acceso a reportes financieros, pagos, inventario y exportacion de datos',1,'2026-04-02 22:54:28.410','2026-04-02 22:56:22.933'),('4c4b2304-8bce-4a95-8490-232c518a0d6b','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Empleado','staff','Estilista/Profesional — ve sus citas, completa servicios y consulta clientes',1,'2026-04-02 22:54:28.407','2026-04-02 22:56:22.930'),('70ba2a17-ffc7-407e-b8f5-f6f991d87134','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Solo Lectura','readonly','Observador — puede ver toda la informacion pero no modificar nada',1,'2026-04-02 22:54:28.413','2026-04-02 22:56:22.937'),('7c46ba7a-5d92-4ac7-9897-b1fd81449d38','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Recepcion','frontdesk','Recepcionista — agenda citas, atiende clientes, cobra en POS y valida cupones',1,'2026-04-02 22:54:28.404','2026-04-02 22:56:22.927'),('89723ac8-e892-4782-be6b-76e8a550df42','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Manager','manager','Gerente — gestiona operaciones diarias, personal, inventario, reportes y promociones',1,'2026-04-02 22:54:28.400','2026-04-02 22:56:22.922'),('f2fafdef-8f90-4927-9999-08be11dd1e72','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Owner','owner','Dueno del negocio — acceso total a todas las funciones incluyendo facturacion y configuracion',1,'2026-04-02 22:54:28.391','2026-04-02 22:56:22.911');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_addons`
--

DROP TABLE IF EXISTS `service_addons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_addons` (
  `id` varchar(191) NOT NULL,
  `service_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `duration_minutes` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `service_addons_service_id_idx` (`service_id`),
  CONSTRAINT `service_addons_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_addons`
--

LOCK TABLES `service_addons` WRITE;
/*!40000 ALTER TABLE `service_addons` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_addons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_bundles`
--

DROP TABLE IF EXISTS `service_bundles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_bundles` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `bundle_price` decimal(10,2) NOT NULL,
  `service_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`service_ids`)),
  `total_duration` int(11) NOT NULL,
  `savings_percent` decimal(5,2) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `service_bundles_tenant_id_is_active_idx` (`tenant_id`,`is_active`),
  CONSTRAINT `service_bundles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_bundles`
--

LOCK TABLES `service_bundles` WRITE;
/*!40000 ALTER TABLE `service_bundles` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_bundles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_catalog`
--

DROP TABLE IF EXISTS `service_catalog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_catalog` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `category` varchar(191) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `service_catalog_name_category_key` (`name`,`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_catalog`
--

LOCK TABLES `service_catalog` WRITE;
/*!40000 ALTER TABLE `service_catalog` DISABLE KEYS */;
INSERT INTO `service_catalog` VALUES ('5aab0c48-2ee7-11f1-baee-00a741030a54','Alisado','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac7744-2ee7-11f1-baee-00a741030a54','Alisado','Barbería',1,0,'2026-04-02 16:57:25.000'),('5aac781d-2ee7-11f1-baee-00a741030a54','Balayage','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac786f-2ee7-11f1-baee-00a741030a54','Barba','Barbería',1,0,'2026-04-02 16:57:25.000'),('5aac78c8-2ee7-11f1-baee-00a741030a54','Cejas','Rostro',1,0,'2026-04-02 16:57:25.000'),('5aac7f52-2ee7-11f1-baee-00a741030a54','Coloración','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac7f9c-2ee7-11f1-baee-00a741030a54','Coloración','Barbería',1,0,'2026-04-02 16:57:25.000'),('5aac7fc5-2ee7-11f1-baee-00a741030a54','Corte de cabello','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac7fec-2ee7-11f1-baee-00a741030a54','Corte de cabello','Barbería',1,0,'2026-04-02 16:57:25.000'),('5aac801a-2ee7-11f1-baee-00a741030a54','Depilación','Cuerpo',1,0,'2026-04-02 16:57:25.000'),('5aac8040-2ee7-11f1-baee-00a741030a54','Diseño de cejas','Rostro',1,0,'2026-04-02 16:57:25.000'),('5aac8067-2ee7-11f1-baee-00a741030a54','Diseño de cejas','Barbería',1,0,'2026-04-02 16:57:25.000'),('5aac8091-2ee7-11f1-baee-00a741030a54','Extensiones','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac80b0-2ee7-11f1-baee-00a741030a54','Facial','Rostro',1,0,'2026-04-02 16:57:25.000'),('5aac80d0-2ee7-11f1-baee-00a741030a54','Keratina','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac80f3-2ee7-11f1-baee-00a741030a54','Keratina','Barbería',1,0,'2026-04-02 16:57:25.000'),('5aac8113-2ee7-11f1-baee-00a741030a54','Manicure','Uñas',1,0,'2026-04-02 16:57:25.000'),('5aac813d-2ee7-11f1-baee-00a741030a54','Maquillaje','Rostro',1,0,'2026-04-02 16:57:25.000'),('5aac815e-2ee7-11f1-baee-00a741030a54','Masaje','Cuerpo',1,0,'2026-04-02 16:57:25.000'),('5aac817f-2ee7-11f1-baee-00a741030a54','Mechas','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac81a2-2ee7-11f1-baee-00a741030a54','Pedicure','Uñas',1,0,'2026-04-02 16:57:25.000'),('5aac81c4-2ee7-11f1-baee-00a741030a54','Peinado','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac81e4-2ee7-11f1-baee-00a741030a54','Pestañas','Rostro',1,0,'2026-04-02 16:57:25.000'),('5aac8206-2ee7-11f1-baee-00a741030a54','Piercing','Cuerpo',1,0,'2026-04-02 16:57:25.000'),('5aac8228-2ee7-11f1-baee-00a741030a54','Rasurado','Barbería',1,0,'2026-04-02 16:57:25.000'),('5aac8249-2ee7-11f1-baee-00a741030a54','Tatuaje','Cuerpo',1,0,'2026-04-02 16:57:25.000'),('5aac825e-2ee7-11f1-baee-00a741030a54','Tinte','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac8271-2ee7-11f1-baee-00a741030a54','Tinte','Barbería',1,0,'2026-04-02 16:57:25.000'),('5aac828a-2ee7-11f1-baee-00a741030a54','Tratamiento capilar','Cabello',1,0,'2026-04-02 16:57:25.000'),('5aac82a4-2ee7-11f1-baee-00a741030a54','Tratamiento capilar','Barbería',1,0,'2026-04-02 16:57:25.000'),('5aac82be-2ee7-11f1-baee-00a741030a54','Uñas acrílicas','Uñas',1,0,'2026-04-02 16:57:25.000'),('5aac82d4-2ee7-11f1-baee-00a741030a54','Uñas de gel','Uñas',1,0,'2026-04-02 16:57:25.000');
/*!40000 ALTER TABLE `service_catalog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_resources`
--

DROP TABLE IF EXISTS `service_resources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_resources` (
  `service_id` varchar(191) NOT NULL,
  `resource_id` varchar(191) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`service_id`,`resource_id`),
  KEY `service_resources_resource_id_fkey` (`resource_id`),
  CONSTRAINT `service_resources_resource_id_fkey` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `service_resources_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_resources`
--

LOCK TABLES `service_resources` WRITE;
/*!40000 ALTER TABLE `service_resources` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_resources` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `services` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `duration_minutes` int(11) NOT NULL,
  `buffer_before_minutes` int(11) NOT NULL DEFAULT 0,
  `buffer_after_minutes` int(11) NOT NULL DEFAULT 0,
  `price` decimal(10,2) NOT NULL,
  `currency` varchar(191) NOT NULL DEFAULT 'USD',
  `color` varchar(191) NOT NULL DEFAULT '#6366f1',
  `category` varchar(191) DEFAULT NULL,
  `subcategory` varchar(191) DEFAULT NULL,
  `points_reward` int(11) DEFAULT NULL,
  `redeemable_with_points` tinyint(1) NOT NULL DEFAULT 0,
  `points_required` int(11) DEFAULT NULL,
  `deposit_required` tinyint(1) NOT NULL DEFAULT 0,
  `deposit_percent` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `services_tenant_id_idx` (`tenant_id`),
  KEY `services_tenant_id_is_active_idx` (`tenant_id`,`is_active`),
  CONSTRAINT `services_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `services`
--

LOCK TABLES `services` WRITE;
/*!40000 ALTER TABLE `services` DISABLE KEYS */;
INSERT INTO `services` VALUES ('094d585d-29ed-489a-8230-23d5c9c50cf5','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Corte de Cabello','Corte profesional con lavado y secado',30,0,5,25.00,'USD','#6366f1','SALON','Corte',25,0,NULL,0,NULL,1,1,'2026-04-02 22:54:28.600','2026-04-02 22:54:28.600'),('0b240314-0a21-4c06-a74b-6a98a7f966b5','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Facial Profundo','Tratamiento facial de limpieza profunda',60,5,10,50.00,'USD','#14b8a6','SPA','Faciales',50,0,NULL,0,NULL,1,5,'2026-04-02 22:54:28.607','2026-04-02 22:54:28.607'),('12a84508-ff1d-4f4d-a88d-f8cef7a369e4','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Tinte Completo','Coloración completa con productos premium',90,5,10,80.00,'USD','#8b5cf6','SALON','Coloración',80,0,NULL,0,NULL,1,2,'2026-04-02 22:54:28.602','2026-04-02 22:54:28.602'),('f2ae6230-1d04-47f2-ba46-f116707e8e30','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Peinado y Brushing','Lavado, secado y peinado profesional',45,0,5,35.00,'USD','#ec4899','SALON','Peinados y Styling',35,0,NULL,0,NULL,1,3,'2026-04-02 22:54:28.603','2026-04-02 22:54:28.603'),('fe0ec01d-c98f-4338-99c5-529ccb656627','ed2de3f5-d5b6-4f00-8549-c1078aba153a','Manicure Clásico','Manicure clásico con limado y esmaltado',30,0,5,20.00,'USD','#f43f5e','GENERAL','Manicure y Pedicure',20,0,NULL,0,NULL,1,4,'2026-04-02 22:54:28.605','2026-04-02 22:54:28.605');
/*!40000 ALTER TABLE `services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `subscriptions` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `plan` enum('BASICO','PLUS','PRO') NOT NULL DEFAULT 'BASICO',
  `status` enum('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `monthly_amount_usd` decimal(10,2) NOT NULL,
  `base_monthly_usd` decimal(10,2) NOT NULL DEFAULT 10.00,
  `per_employee_usd` decimal(10,2) NOT NULL DEFAULT 10.00,
  `billed_employee_count` int(11) NOT NULL DEFAULT 0,
  `available_licenses` int(11) NOT NULL DEFAULT 0,
  `plan_interval` varchar(191) NOT NULL DEFAULT 'MONTHLY',
  `annual_amount_usd` decimal(10,2) DEFAULT NULL,
  `annual_period_end` datetime(3) DEFAULT NULL,
  `advance_paid` tinyint(1) NOT NULL DEFAULT 0,
  `contract_start_date` datetime(3) NOT NULL,
  `contract_end_date` datetime(3) NOT NULL,
  `next_billing_date` datetime(3) NOT NULL,
  `last_payment_date` datetime(3) DEFAULT NULL,
  `grace_period_ends_at` datetime(3) DEFAULT NULL,
  `cancelled_at` datetime(3) DEFAULT NULL,
  `trial_ends_at` datetime(3) DEFAULT NULL,
  `stripe_customer_id` varchar(255) DEFAULT NULL,
  `stripe_subscription_id` varchar(255) DEFAULT NULL,
  `stripe_price_id` varchar(255) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscriptions_tenant_id_key` (`tenant_id`),
  CONSTRAINT `subscriptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptions`
--

LOCK TABLES `subscriptions` WRITE;
/*!40000 ALTER TABLE `subscriptions` DISABLE KEYS */;
INSERT INTO `subscriptions` VALUES ('29ed22ae-8b71-4f36-81d3-290ee8a89bf8','ed2de3f5-d5b6-4f00-8549-c1078aba153a','BASICO','ACTIVE',29.99,10.00,10.00,0,0,'MONTHLY',NULL,NULL,0,'2026-04-02 22:54:29.188','2027-04-02 22:54:29.188','2026-05-02 22:54:29.188','2026-04-02 22:54:29.188',NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-02 22:54:29.190','2026-04-02 22:54:29.190');
/*!40000 ALTER TABLE `subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `suppliers` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `contact_name` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `suppliers_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `suppliers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_gallery_images`
--

DROP TABLE IF EXISTS `tenant_gallery_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_gallery_images` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `image_url` varchar(191) NOT NULL,
  `caption` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `tenant_gallery_images_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `tenant_gallery_images_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_gallery_images`
--

LOCK TABLES `tenant_gallery_images` WRITE;
/*!40000 ALTER TABLE `tenant_gallery_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_gallery_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_invite_code_services`
--

DROP TABLE IF EXISTS `tenant_invite_code_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_invite_code_services` (
  `id` varchar(191) NOT NULL,
  `invite_code_id` varchar(191) NOT NULL,
  `service_id` varchar(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_invite_code_services_invite_code_id_service_id_key` (`invite_code_id`,`service_id`),
  KEY `tenant_invite_code_services_service_id_fkey` (`service_id`),
  CONSTRAINT `tenant_invite_code_services_invite_code_id_fkey` FOREIGN KEY (`invite_code_id`) REFERENCES `tenant_invite_codes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tenant_invite_code_services_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_invite_code_services`
--

LOCK TABLES `tenant_invite_code_services` WRITE;
/*!40000 ALTER TABLE `tenant_invite_code_services` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_invite_code_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_invite_codes`
--

DROP TABLE IF EXISTS `tenant_invite_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_invite_codes` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `code` varchar(191) NOT NULL,
  `job_title` varchar(191) DEFAULT NULL,
  `max_uses` int(11) NOT NULL DEFAULT 0,
  `used_count` int(11) NOT NULL DEFAULT 0,
  `expires_at` datetime(3) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_invite_codes_code_key` (`code`),
  KEY `tenant_invite_codes_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `tenant_invite_codes_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_invite_codes`
--

LOCK TABLES `tenant_invite_codes` WRITE;
/*!40000 ALTER TABLE `tenant_invite_codes` DISABLE KEYS */;
INSERT INTO `tenant_invite_codes` VALUES ('be3ac7d0-346a-4564-870a-1a3252288b0e','ed2de3f5-d5b6-4f00-8549-c1078aba153a','DEMOSALON',NULL,0,0,NULL,1,'2026-04-02 22:54:28.835');
/*!40000 ALTER TABLE `tenant_invite_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenants`
--

DROP TABLE IF EXISTS `tenants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenants` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `logo_url` varchar(191) DEFAULT NULL,
  `timezone` varchar(191) NOT NULL DEFAULT 'UTC',
  `currency` varchar(191) NOT NULL DEFAULT 'USD',
  `settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`settings`)),
  `business_type` varchar(191) DEFAULT NULL,
  `address` varchar(191) DEFAULT NULL,
  `business_phone` varchar(191) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `cover_image_url` varchar(191) DEFAULT NULL,
  `card_color` varchar(191) DEFAULT NULL,
  `is_marketplace_listed` tinyint(1) NOT NULL DEFAULT 0,
  `contract_accepted_at` datetime(3) DEFAULT NULL,
  `stripe_account_id` varchar(191) DEFAULT NULL,
  `stripe_onboarding_complete` tinyint(1) NOT NULL DEFAULT 0,
  `subscription_plan` varchar(191) NOT NULL DEFAULT 'free',
  `subscription_status` varchar(191) NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenants_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenants`
--

LOCK TABLES `tenants` WRITE;
/*!40000 ALTER TABLE `tenants` DISABLE KEYS */;
INSERT INTO `tenants` VALUES ('ed2de3f5-d5b6-4f00-8549-c1078aba153a','Demo Salon','demo-salon','contact@demo-salon.com','+1-555-0100',NULL,'America/New_York','USD','{}','SALON','Av. Juarez 975, Centro, Guadalajara',NULL,'El mejor salón de belleza de la zona. Servicios profesionales de corte, color, manicura y más.','/api/uploads/avatars/cover-1772686771095-c33kej.jpg',NULL,1,NULL,NULL,0,'professional','active','2026-04-02 22:54:28.386','2026-04-02 22:56:23.512');
/*!40000 ALTER TABLE `tenants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_roles` (
  `id` varchar(191) NOT NULL,
  `user_id` varchar(191) NOT NULL,
  `role_id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `location_id` varchar(191) DEFAULT NULL,
  `assigned_by` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `user_roles_user_id_tenant_id_idx` (`user_id`,`tenant_id`),
  KEY `user_roles_tenant_id_idx` (`tenant_id`),
  KEY `user_roles_role_id_fkey` (`role_id`),
  KEY `user_roles_location_id_fkey` (`location_id`),
  CONSTRAINT `user_roles_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_roles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES ('35f7fb2f-74d6-44c2-b755-ad079b2d6213','6ce839aa-901e-49a4-a13d-c78ce173c0c6','4c4b2304-8bce-4a95-8490-232c518a0d6b','ed2de3f5-d5b6-4f00-8549-c1078aba153a',NULL,NULL,'2026-04-02 22:54:28.833'),('95522746-8220-4b88-9483-db043076255c','3ca3cbcd-5744-48f1-8a6b-766c3654fb48','f2fafdef-8f90-4927-9999-08be11dd1e72','ed2de3f5-d5b6-4f00-8549-c1078aba153a',NULL,NULL,'2026-04-02 22:54:28.598'),('c3919982-55ae-434b-81b5-78053785439e','89a47421-1dc8-4cf6-ab08-202bb5d569d3','4c4b2304-8bce-4a95-8490-232c518a0d6b','ed2de3f5-d5b6-4f00-8549-c1078aba153a',NULL,NULL,'2026-04-02 22:54:28.825'),('f55629ee-ca70-460f-8198-310b76b04c08','923384c3-3ef5-4ffe-8947-31cbb819dc30','4c4b2304-8bce-4a95-8490-232c518a0d6b','ed2de3f5-d5b6-4f00-8549-c1078aba153a',NULL,NULL,'2026-04-02 22:54:28.829');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password_hash` varchar(191) NOT NULL,
  `first_name` varchar(191) NOT NULL,
  `last_name` varchar(191) NOT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `avatar_url` varchar(191) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `email_verified_at` datetime(3) DEFAULT NULL,
  `last_login_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_tenant_id_email_key` (`tenant_id`,`email`),
  KEY `users_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `users_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('3ca3cbcd-5744-48f1-8a6b-766c3654fb48','ed2de3f5-d5b6-4f00-8549-c1078aba153a','admin@siliba.com','$2b$12$7RcyVAbCmqk8LExdWOtsOer05PEmGNuhhK0vMzS8qroT0VU5iYa3e','Admin','Owner','+1-555-0100',NULL,1,NULL,NULL,'2026-04-02 22:54:28.586','2026-04-02 22:54:28.586'),('6ce839aa-901e-49a4-a13d-c78ce173c0c6','ed2de3f5-d5b6-4f00-8549-c1078aba153a','sofia@demo-salon.com','$2b$12$wZju./KxSjvtCtAFPNwGu.z81z/L54cjJk4qp.tL2vQkUXAWrHMku','Sofia','Martinez','+1-555-0203',NULL,1,NULL,NULL,'2026-04-02 22:54:28.831','2026-04-02 22:54:28.831'),('89a47421-1dc8-4cf6-ab08-202bb5d569d3','ed2de3f5-d5b6-4f00-8549-c1078aba153a','maria@demo-salon.com','$2b$12$wZju./KxSjvtCtAFPNwGu.z81z/L54cjJk4qp.tL2vQkUXAWrHMku','Maria','Garcia','+1-555-0201',NULL,1,NULL,NULL,'2026-04-02 22:54:28.812','2026-04-02 22:54:28.812'),('923384c3-3ef5-4ffe-8947-31cbb819dc30','ed2de3f5-d5b6-4f00-8549-c1078aba153a','james@demo-salon.com','$2b$12$wZju./KxSjvtCtAFPNwGu.z81z/L54cjJk4qp.tL2vQkUXAWrHMku','James','Wilson','+1-555-0202',NULL,1,NULL,NULL,'2026-04-02 22:54:28.827','2026-04-02 22:54:28.827');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-02 17:00:44
