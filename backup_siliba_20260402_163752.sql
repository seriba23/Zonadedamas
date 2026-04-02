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

-- Dump completed on 2026-04-02 16:37:52
