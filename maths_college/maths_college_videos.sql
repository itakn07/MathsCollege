-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: maths_college
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `videos`
--

DROP TABLE IF EXISTS `videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `videos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titre` varchar(255) NOT NULL,
  `youtube_id` varchar(255) DEFAULT NULL,
  `niveau_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `niveau_id` (`niveau_id`),
  CONSTRAINT `videos_ibfk_1` FOREIGN KEY (`niveau_id`) REFERENCES `niveaux` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `videos`
--

LOCK TABLES `videos` WRITE;
/*!40000 ALTER TABLE `videos` DISABLE KEYS */;
INSERT INTO `videos` VALUES (1,'6e: Nombres décimaux','https://www.youtube.com/embed/LOp-LK2XQ5A',1),(2,'6e: Grands nombres','https://www.youtube.com/embed/ZDja3ZCJN6g',1),(3,'6e: Comparer décimaux','https://www.youtube.com/embed/9kfWxtKrldU',1),(12,'5e:Symétrie centrale','https://www.youtube.com/watch?v=-ZWAUCXmXB4',2),(13,'5e: Les Nombres relatifs','https://www.youtube.com/watch?v=YivvFtSuzno',2),(14,'5e: Les Proportionnalités','https://www.youtube.com/watch?v=EyGAqcya_5g',2),(15,'5e: Reconnaitre un tableau de proportionnalité','https://www.youtube.com/watch?v=O7oU-J1OqCw',2),(16,'4e: Les Equations','https://www.youtube.com/watch?v=Z0i031tIdpQ',3),(17,'4e: Reconnaitre si un nombre est solution d\'une équation','https://www.youtube.com/watch?v=PLuSPM6rJKI',3),(18,'4e: Mettre un probleme en équation','https://www.youtube.com/watch?v=q3ijSWk1iF8',3),(19,'4e: Résoudre une équation','https://www.youtube.com/watch?v=uV_EmbYu9_E',3),(20,'3e: Les Equations','https://www.youtube.com/watch?v=WoTpA2RyuVU',4),(21,'3e: Notion de Fonctions','https://www.youtube.com/watch?v=E4SY8_L-DTA',4),(22,'3e: Résoudre un problème avec une fonction','https://www.youtube.com/watch?v=02mDFbESIbk',4);
/*!40000 ALTER TABLE `videos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-23  4:57:45
