#!/usr/bin/env python3
"""
Dev-time content generator for LinguaLoop.

The app itself only reads the JSON files in content/<course>/. This script is
how those files were produced from the hand-written vocabulary and sentence
lists below, so content can be edited in one place and regenerated:

    python3 scripts/gen-content.py

Output is deterministic (seeded RNG). Not used at runtime and not needed on
the server.
"""
import json
import os
import random
import re
import unicodedata

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "content")

# Each vocab item: (target, english, [english alternatives], [target alternatives])
# Each sentence:   (target, english, [english alternatives], [target alternatives])


def V(t, e, ealt=None, talt=None):
    return {"t": t, "e": e, "ealt": ealt or [], "talt": talt or []}


S = V  # same shape

MUM = ["Mum", "Mom"]

SPANISH = {
    "id": "spanish",
    "title": "Spanish",
    "nativeName": "Español",
    "speechLang": "es-ES",
    "description": "Learn everyday Spanish: greetings, numbers, food, family and getting around.",
    "units": [
        {
            "title": "First steps",
            "description": "Say hello, introduce yourself and be polite.",
            "skills": [
                {
                    "title": "Greetings",
                    "icon": "wave",
                    "tip": "Use 'buenos días' until lunchtime, 'buenas tardes' in the afternoon and early evening, and 'buenas noches' late in the evening or to say good night.",
                    "vocab": [
                        V("hola", "hello", ["hi"]),
                        V("adiós", "goodbye", ["bye"]),
                        V("buenos días", "good morning"),
                        V("buenas tardes", "good afternoon", ["good evening"]),
                        V("buenas noches", "good night", ["good evening"]),
                        V("gracias", "thank you", ["thanks"]),
                        V("por favor", "please"),
                        V("hasta luego", "see you later", ["see you", "bye"]),
                    ],
                    "sentences": [
                        S("Hola, ¿qué tal?", "Hello, how are you?", ["Hi, how are you?", "Hello, how is it going?", "Hi, how is it going?", "Hello, how are things?"], ["Hola, ¿cómo estás?"]),
                        S("Buenos días, señor.", "Good morning, sir."),
                        S("Buenas noches, mamá.", "Good night, Mum.", ["Good night, Mom.", "Good evening, Mum.", "Good evening, Mom.", "Good night, Mother."]),
                        S("Adiós, hasta mañana.", "Goodbye, see you tomorrow.", ["Bye, see you tomorrow.", "Goodbye, until tomorrow."]),
                        S("Muy bien, gracias.", "Very well, thank you.", ["Very well, thanks.", "Very good, thank you.", "Very good, thanks."]),
                        S("¿Cómo estás?", "How are you?", [], ["¿Qué tal?", "¿Cómo estás tú?"]),
                        S("Estoy bien.", "I am fine.", ["I am well.", "I am good.", "I am okay.", "I am OK."], ["Yo estoy bien."]),
                    ],
                },
                {
                    "title": "Introductions",
                    "icon": "person",
                    "tip": "'Tú' is the informal 'you'. Accents matter in writing: 'tú' (you) and 'tu' (your) are different words.",
                    "vocab": [
                        V("yo", "I"),
                        V("tú", "you"),
                        V("él", "he"),
                        V("ella", "she"),
                        V("nombre", "name"),
                        V("mucho gusto", "nice to meet you", ["pleased to meet you"]),
                        V("amigo", "friend"),
                        V("país", "country"),
                    ],
                    "sentences": [
                        S("Me llamo Ana.", "My name is Ana.", ["I am called Ana.", "I am Ana."], ["Yo me llamo Ana.", "Mi nombre es Ana.", "Soy Ana."]),
                        S("¿Cómo te llamas?", "What is your name?", ["What are you called?"], ["¿Cuál es tu nombre?"]),
                        S("Soy de Inglaterra.", "I am from England.", [], ["Yo soy de Inglaterra."]),
                        S("Ella es de México.", "She is from Mexico."),
                        S("Él es mi amigo.", "He is my friend.", [], ["Es mi amigo."]),
                        S("Mucho gusto, Carlos.", "Nice to meet you, Carlos.", ["Pleased to meet you, Carlos."]),
                        S("¿De dónde eres?", "Where are you from?", [], ["¿De dónde eres tú?"]),
                    ],
                },
                {
                    "title": "Being polite",
                    "icon": "heart",
                    "tip": "Spanish questions start with an upside-down question mark (¿) and exclamations with (¡). You do not need to type them here.",
                    "vocab": [
                        V("perdón", "excuse me", ["sorry", "pardon"], ["disculpe", "perdone"]),
                        V("lo siento", "I am sorry", ["sorry"]),
                        V("de nada", "you are welcome"),
                        V("sí", "yes"),
                        V("entiendo", "I understand"),
                        V("bienvenido", "welcome"),
                        V("claro", "of course", ["sure"]),
                        V("un poco", "a little", ["a bit"]),
                    ],
                    "sentences": [
                        S("Muchas gracias.", "Thank you very much.", ["Thanks a lot.", "Many thanks.", "Thank you so much."]),
                        S("De nada.", "You are welcome."),
                        S("Lo siento mucho.", "I am very sorry.", ["I am so sorry.", "I am really sorry."]),
                        S("Perdón, ¿hablas inglés?", "Excuse me, do you speak English?", ["Sorry, do you speak English?"], ["Perdón, ¿habla inglés?"]),
                        S("Sí, un poco.", "Yes, a little.", ["Yes, a bit."]),
                        S("No entiendo.", "I do not understand.", [], ["Yo no entiendo."]),
                        S("Más despacio, por favor.", "More slowly, please.", ["Slower, please.", "Slowly, please."]),
                    ],
                },
            ],
        },
        {
            "title": "Everyday basics",
            "description": "Numbers, food and drink, and talking about your family.",
            "skills": [
                {
                    "title": "Numbers 1–10",
                    "icon": "hash",
                    "tip": "'Uno' becomes 'un' before a masculine noun (un libro) and 'una' before a feminine noun (una manzana).",
                    "vocab": [
                        V("uno", "one", ["1"]),
                        V("dos", "two", ["2"]),
                        V("tres", "three", ["3"]),
                        V("cuatro", "four", ["4"]),
                        V("cinco", "five", ["5"]),
                        V("seis", "six", ["6"]),
                        V("siete", "seven", ["7"]),
                        V("ocho", "eight", ["8"]),
                        V("nueve", "nine", ["9"]),
                        V("diez", "ten", ["10"]),
                    ],
                    "sentences": [
                        S("Tengo dos hermanos.", "I have two brothers.", ["I have two siblings.", "I have 2 brothers.", "I have 2 siblings."]),
                        S("Tengo veinte años.", "I am twenty years old.", ["I am twenty.", "I am 20 years old.", "I am 20."]),
                        S("Son las tres.", "It is three o'clock.", ["It is three.", "It is 3 o'clock.", "It is 3."]),
                        S("Quiero cinco manzanas.", "I want five apples.", ["I want 5 apples.", "I would like five apples."]),
                        S("¿Cuántos años tienes?", "How old are you?", [], ["¿Cuántos años tiene?", "¿Cuántos años tiene usted?"]),
                        S("Hay diez libros.", "There are ten books.", ["There are 10 books."]),
                        S("Tengo cuatro gatos.", "I have four cats.", ["I have 4 cats."]),
                    ],
                },
                {
                    "title": "Food and drink",
                    "icon": "cup",
                    "tip": "'Me gusta' literally means 'it pleases me'. Spanish usually keeps the article: 'Me gusta el café' = 'I like coffee'.",
                    "vocab": [
                        V("agua", "water"),
                        V("pan", "bread"),
                        V("leche", "milk"),
                        V("café", "coffee"),
                        V("manzana", "apple", ["an apple"]),
                        V("queso", "cheese"),
                        V("arroz", "rice"),
                        V("pollo", "chicken"),
                        V("carne", "meat"),
                    ],
                    "sentences": [
                        S("Yo como pan.", "I eat bread.", ["I am eating bread."], ["Como pan."]),
                        S("Ella bebe agua.", "She drinks water.", ["She is drinking water."]),
                        S("Me gusta el café.", "I like coffee.", ["I like the coffee."]),
                        S("Quiero una manzana.", "I want an apple.", ["I would like an apple."], ["Yo quiero una manzana."]),
                        S("El queso es bueno.", "The cheese is good.", ["Cheese is good."], ["El queso está bueno."]),
                        S("No como carne.", "I do not eat meat.", [], ["Yo no como carne."]),
                        S("Tengo hambre.", "I am hungry.", [], ["Yo tengo hambre."]),
                    ],
                },
                {
                    "title": "Family",
                    "icon": "home",
                    "tip": "The masculine plural can cover mixed groups: 'hermanos' can mean 'brothers' or 'brothers and sisters'.",
                    "vocab": [
                        V("madre", "mother", ["mum", "mom"]),
                        V("padre", "father", ["dad"]),
                        V("hermano", "brother"),
                        V("hermana", "sister"),
                        V("hijo", "son"),
                        V("hija", "daughter"),
                        V("abuela", "grandmother", ["grandma", "granny"]),
                        V("abuelo", "grandfather", ["grandpa", "grandad"]),
                        V("familia", "family"),
                    ],
                    "sentences": [
                        S("Mi madre se llama Rosa.", "My mother is called Rosa.", ["My mother's name is Rosa.", "My mum is called Rosa.", "My mom is called Rosa.", "My mum's name is Rosa.", "My mom's name is Rosa."]),
                        S("Tengo una hermana.", "I have a sister.", ["I have one sister."]),
                        S("Mi padre es alto.", "My father is tall.", ["My dad is tall."]),
                        S("Ellos son mis abuelos.", "They are my grandparents.", [], ["Son mis abuelos."]),
                        S("Mi hermano tiene un hijo.", "My brother has a son.", ["My brother has one son."]),
                        S("Mi familia es grande.", "My family is big.", ["My family is large."]),
                        S("¿Tienes hijos?", "Do you have children?", ["Do you have kids?", "Have you got children?", "Have you got kids?"]),
                    ],
                },
            ],
        },
        {
            "title": "Out and about",
            "description": "Travel basics, ordering at a café, and days of the week.",
            "skills": [
                {
                    "title": "Getting around",
                    "icon": "train",
                    "tip": "'Billete' is used in Spain; in much of Latin America a ticket is a 'boleto'.",
                    "vocab": [
                        V("tren", "train"),
                        V("autobús", "bus"),
                        V("aeropuerto", "airport"),
                        V("estación", "station"),
                        V("billete", "ticket", [], ["boleto"]),
                        V("hotel", "hotel"),
                        V("calle", "street"),
                        V("mapa", "map"),
                    ],
                    "sentences": [
                        S("¿Dónde está la estación?", "Where is the station?"),
                        S("Un billete, por favor.", "A ticket, please.", ["One ticket, please."], ["Un boleto, por favor."]),
                        S("El tren sale a las ocho.", "The train leaves at eight.", ["The train leaves at eight o'clock.", "The train leaves at 8.", "The train departs at eight.", "The train departs at 8."]),
                        S("Voy al aeropuerto.", "I am going to the airport.", ["I go to the airport."], ["Yo voy al aeropuerto."]),
                        S("El hotel está cerca.", "The hotel is near.", ["The hotel is nearby.", "The hotel is close.", "The hotel is close by."]),
                        S("Necesito un mapa.", "I need a map.", [], ["Yo necesito un mapa."]),
                        S("¿A qué hora sale el autobús?", "What time does the bus leave?", ["At what time does the bus leave?", "What time does the bus depart?"]),
                    ],
                },
                {
                    "title": "At the café",
                    "icon": "fork",
                    "tip": "'Zumo' is used in Spain and 'jugo' in Latin America. Both are accepted.",
                    "vocab": [
                        V("camarero", "waiter"),
                        V("cuenta", "bill", ["check"]),
                        V("menú", "menu"),
                        V("té", "tea"),
                        V("cerveza", "beer"),
                        V("vino", "wine"),
                        V("mesa", "table"),
                        V("zumo", "juice", [], ["jugo"]),
                    ],
                    "sentences": [
                        S("Un café, por favor.", "A coffee, please.", ["One coffee, please."]),
                        S("La cuenta, por favor.", "The bill, please.", ["The check, please."]),
                        S("Una mesa para dos.", "A table for two."),
                        S("Quiero un té con leche.", "I want a tea with milk.", ["I want tea with milk.", "I would like a tea with milk.", "I would like tea with milk."]),
                        S("¿Cuánto cuesta?", "How much is it?", ["How much does it cost?"], ["¿Cuánto es?"]),
                        S("El vino es muy bueno.", "The wine is very good."),
                        S("Para mí, una cerveza.", "For me, a beer.", ["A beer for me."]),
                    ],
                },
                {
                    "title": "Days and time",
                    "icon": "calendar",
                    "tip": "Days of the week are not capitalised in Spanish. 'El lunes' means 'on Monday'.",
                    "vocab": [
                        V("lunes", "Monday"),
                        V("martes", "Tuesday"),
                        V("miércoles", "Wednesday"),
                        V("jueves", "Thursday"),
                        V("viernes", "Friday"),
                        V("sábado", "Saturday"),
                        V("domingo", "Sunday"),
                        V("hoy", "today"),
                        V("mañana", "tomorrow", ["morning"]),
                        V("semana", "week"),
                    ],
                    "sentences": [
                        S("Hoy es lunes.", "Today is Monday.", ["It is Monday today."]),
                        S("Mañana es sábado.", "Tomorrow is Saturday."),
                        S("Trabajo el viernes.", "I work on Friday.", ["I am working on Friday.", "I work Friday.", "I am working Friday."], ["Yo trabajo el viernes."]),
                        S("¿Qué hora es?", "What time is it?"),
                        S("Es la una.", "It is one o'clock.", ["It is one.", "It is 1 o'clock.", "It is 1."]),
                        S("Hasta el domingo.", "See you on Sunday.", ["See you Sunday.", "Until Sunday."]),
                        S("La semana tiene siete días.", "The week has seven days.", ["A week has seven days.", "The week has 7 days.", "A week has 7 days."]),
                    ],
                },
            ],
        },
    ],
}

PORTUGUESE = {
    "id": "portuguese",
    "title": "Portuguese (Portugal)",
    "nativeName": "Português europeu",
    "speechLang": "pt-PT",
    "description": "Learn European Portuguese as spoken in Portugal: greetings, numbers, food, family and travel.",
    "units": [
        {
            "title": "First steps",
            "description": "Say hello, introduce yourself and be polite.",
            "skills": [
                {
                    "title": "Greetings",
                    "icon": "wave",
                    "tip": "Men say 'obrigado' and women say 'obrigada'. Both mean 'thank you'.",
                    "vocab": [
                        V("olá", "hello", ["hi"]),
                        V("adeus", "goodbye", ["bye"]),
                        V("bom dia", "good morning"),
                        V("boa tarde", "good afternoon", ["good evening"]),
                        V("boa noite", "good night", ["good evening"]),
                        V("obrigado", "thank you", ["thanks"], ["obrigada"]),
                        V("por favor", "please"),
                        V("até logo", "see you later", ["see you", "bye"]),
                    ],
                    "sentences": [
                        S("Olá, tudo bem?", "Hello, how are you?", ["Hi, how are you?", "Hello, all good?", "Hi, all good?", "Hello, how is it going?", "Hi, how is it going?", "Hello, is everything OK?", "Hi, is everything OK?"]),
                        S("Bom dia, senhor.", "Good morning, sir."),
                        S("Boa noite, mãe.", "Good night, Mum.", ["Good night, Mom.", "Good evening, Mum.", "Good evening, Mom.", "Good night, Mother."]),
                        S("Adeus, até amanhã.", "Goodbye, see you tomorrow.", ["Bye, see you tomorrow.", "Goodbye, until tomorrow."]),
                        S("Muito bem, obrigada.", "Very well, thank you.", ["Very well, thanks.", "Very good, thank you.", "Very good, thanks."], ["Muito bem, obrigado."]),
                        S("Como está?", "How are you?", [], ["Como estás?", "Tudo bem?"]),
                        S("Estou bem.", "I am fine.", ["I am well.", "I am good.", "I am okay.", "I am OK."], ["Eu estou bem."]),
                    ],
                },
                {
                    "title": "Introductions",
                    "icon": "person",
                    "tip": "In Portugal the pronoun usually goes after the verb with a hyphen: 'Chamo-me Ana' (My name is Ana).",
                    "vocab": [
                        V("eu", "I"),
                        V("tu", "you"),
                        V("ele", "he"),
                        V("ela", "she"),
                        V("nome", "name"),
                        V("muito prazer", "nice to meet you", ["pleased to meet you"]),
                        V("amigo", "friend"),
                        V("país", "country"),
                    ],
                    "sentences": [
                        S("Chamo-me Ana.", "My name is Ana.", ["I am called Ana.", "I am Ana."], ["Eu chamo-me Ana.", "O meu nome é Ana.", "Sou a Ana."]),
                        S("Como te chamas?", "What is your name?", ["What are you called?"], ["Como se chama?", "Qual é o teu nome?"]),
                        S("Sou de Inglaterra.", "I am from England.", [], ["Eu sou de Inglaterra."]),
                        S("Ela é de Lisboa.", "She is from Lisbon."),
                        S("Ele é o meu amigo.", "He is my friend.", [], ["Ele é meu amigo.", "É o meu amigo."]),
                        S("Muito prazer, Carlos.", "Nice to meet you, Carlos.", ["Pleased to meet you, Carlos."]),
                        S("De onde és?", "Where are you from?", [], ["De onde és tu?", "De onde é?"]),
                    ],
                },
                {
                    "title": "Being polite",
                    "icon": "heart",
                    "tip": "'Percebo' (I understand) is very common in Portugal; 'compreendo' and 'entendo' are also correct.",
                    "vocab": [
                        V("desculpe", "excuse me", ["sorry", "pardon"], ["desculpa", "com licença"]),
                        V("peço desculpa", "I am sorry", ["I apologise", "I apologize", "sorry"]),
                        V("de nada", "you are welcome"),
                        V("sim", "yes"),
                        V("percebo", "I understand", [], ["compreendo", "entendo"]),
                        V("bem-vindo", "welcome"),
                        V("claro", "of course", ["sure"]),
                        V("um pouco", "a little", ["a bit"]),
                    ],
                    "sentences": [
                        S("Muito obrigado.", "Thank you very much.", ["Thanks a lot.", "Many thanks.", "Thank you so much."], ["Muito obrigada."]),
                        S("De nada.", "You are welcome."),
                        S("Peço desculpa.", "I am sorry.", ["I apologise.", "I apologize.", "Sorry."], ["Desculpe.", "Desculpa."]),
                        S("Desculpe, fala inglês?", "Excuse me, do you speak English?", ["Sorry, do you speak English?"], ["Desculpa, falas inglês?"]),
                        S("Sim, um pouco.", "Yes, a little.", ["Yes, a bit."]),
                        S("Não percebo.", "I do not understand.", [], ["Não compreendo.", "Não entendo.", "Eu não percebo."]),
                        S("Mais devagar, por favor.", "More slowly, please.", ["Slower, please.", "Slowly, please."]),
                    ],
                },
            ],
        },
        {
            "title": "Everyday basics",
            "description": "Numbers, food and drink, and talking about your family.",
            "skills": [
                {
                    "title": "Numbers 1–10",
                    "icon": "hash",
                    "tip": "'Um' and 'dois' change for feminine nouns: 'uma maçã', 'duas maçãs'.",
                    "vocab": [
                        V("um", "one", ["1"], ["uma"]),
                        V("dois", "two", ["2"], ["duas"]),
                        V("três", "three", ["3"]),
                        V("quatro", "four", ["4"]),
                        V("cinco", "five", ["5"]),
                        V("seis", "six", ["6"]),
                        V("sete", "seven", ["7"]),
                        V("oito", "eight", ["8"]),
                        V("nove", "nine", ["9"]),
                        V("dez", "ten", ["10"]),
                    ],
                    "sentences": [
                        S("Tenho dois irmãos.", "I have two brothers.", ["I have two siblings.", "I have 2 brothers.", "I have 2 siblings."], ["Eu tenho dois irmãos."]),
                        S("Tenho vinte anos.", "I am twenty years old.", ["I am twenty.", "I am 20 years old.", "I am 20."], ["Eu tenho vinte anos."]),
                        S("São três horas.", "It is three o'clock.", ["It is three.", "It is 3 o'clock.", "It is 3."], ["São as três."]),
                        S("Quero cinco maçãs.", "I want five apples.", ["I want 5 apples.", "I would like five apples."], ["Eu quero cinco maçãs."]),
                        S("Quantos anos tens?", "How old are you?", [], ["Quantos anos tem?"]),
                        S("Há dez livros.", "There are ten books.", ["There are 10 books."]),
                        S("Tenho quatro gatos.", "I have four cats.", ["I have 4 cats."], ["Eu tenho quatro gatos."]),
                    ],
                },
                {
                    "title": "Food and drink",
                    "icon": "cup",
                    "tip": "In Portugal, breakfast is 'o pequeno-almoço' and a short espresso is often called 'uma bica' in Lisbon.",
                    "vocab": [
                        V("água", "water"),
                        V("pão", "bread"),
                        V("leite", "milk"),
                        V("café", "coffee"),
                        V("maçã", "apple", ["an apple"]),
                        V("queijo", "cheese"),
                        V("arroz", "rice"),
                        V("frango", "chicken"),
                        V("carne", "meat"),
                    ],
                    "sentences": [
                        S("Eu como pão.", "I eat bread.", ["I am eating bread."], ["Como pão."]),
                        S("Ela bebe água.", "She drinks water.", ["She is drinking water."]),
                        S("Gosto de café.", "I like coffee.", [], ["Eu gosto de café."]),
                        S("Quero uma maçã.", "I want an apple.", ["I would like an apple."], ["Eu quero uma maçã.", "Queria uma maçã."]),
                        S("O queijo é bom.", "The cheese is good.", ["Cheese is good."], ["O queijo está bom."]),
                        S("Não como carne.", "I do not eat meat.", [], ["Eu não como carne."]),
                        S("Tenho fome.", "I am hungry.", [], ["Eu tenho fome.", "Estou com fome."]),
                    ],
                },
                {
                    "title": "Family",
                    "icon": "home",
                    "tip": "In Portugal the article usually comes before possessives: 'a minha mãe' (my mother), 'o meu pai' (my father).",
                    "vocab": [
                        V("mãe", "mother", ["mum", "mom"]),
                        V("pai", "father", ["dad"]),
                        V("irmão", "brother"),
                        V("irmã", "sister"),
                        V("filho", "son"),
                        V("filha", "daughter"),
                        V("avó", "grandmother", ["grandma", "granny"]),
                        V("avô", "grandfather", ["grandpa", "grandad"]),
                        V("família", "family"),
                    ],
                    "sentences": [
                        S("A minha mãe chama-se Rosa.", "My mother is called Rosa.", ["My mother's name is Rosa.", "My mum is called Rosa.", "My mom is called Rosa.", "My mum's name is Rosa.", "My mom's name is Rosa."], ["Minha mãe chama-se Rosa."]),
                        S("Tenho uma irmã.", "I have a sister.", ["I have one sister."], ["Eu tenho uma irmã."]),
                        S("O meu pai é alto.", "My father is tall.", ["My dad is tall."], ["Meu pai é alto."]),
                        S("Eles são os meus avós.", "They are my grandparents.", [], ["São os meus avós.", "Eles são meus avós."]),
                        S("O meu irmão tem um filho.", "My brother has a son.", ["My brother has one son."], ["Meu irmão tem um filho."]),
                        S("A minha família é grande.", "My family is big.", ["My family is large."], ["Minha família é grande."]),
                        S("Tens filhos?", "Do you have children?", ["Do you have kids?", "Have you got children?", "Have you got kids?"], ["Tem filhos?"]),
                    ],
                },
            ],
        },
        {
            "title": "Out and about",
            "description": "Travel basics, ordering at a café, and days of the week.",
            "skills": [
                {
                    "title": "Getting around",
                    "icon": "train",
                    "tip": "European Portuguese has its own travel words: a train is 'o comboio' and a bus is 'o autocarro'.",
                    "vocab": [
                        V("comboio", "train"),
                        V("autocarro", "bus"),
                        V("aeroporto", "airport"),
                        V("estação", "station"),
                        V("bilhete", "ticket"),
                        V("hotel", "hotel"),
                        V("rua", "street"),
                        V("mapa", "map"),
                    ],
                    "sentences": [
                        S("Onde é a estação?", "Where is the station?", [], ["Onde fica a estação?", "Onde está a estação?"]),
                        S("Um bilhete, por favor.", "A ticket, please.", ["One ticket, please."]),
                        S("O comboio parte às oito.", "The train leaves at eight.", ["The train leaves at eight o'clock.", "The train leaves at 8.", "The train departs at eight.", "The train departs at 8."], ["O comboio sai às oito."]),
                        S("Vou para o aeroporto.", "I am going to the airport.", ["I go to the airport."], ["Vou ao aeroporto.", "Eu vou para o aeroporto."]),
                        S("O hotel fica perto.", "The hotel is near.", ["The hotel is nearby.", "The hotel is close.", "The hotel is close by."], ["O hotel é perto.", "O hotel está perto."]),
                        S("Preciso de um mapa.", "I need a map.", [], ["Eu preciso de um mapa."]),
                        S("A que horas parte o autocarro?", "What time does the bus leave?", ["At what time does the bus leave?", "What time does the bus depart?"], ["A que horas sai o autocarro?"]),
                    ],
                },
                {
                    "title": "At the café",
                    "icon": "fork",
                    "tip": "'Queria' (I would like) is a polite way to order in Portugal. A menu is 'a ementa'.",
                    "vocab": [
                        V("empregado", "waiter"),
                        V("conta", "bill", ["check"]),
                        V("ementa", "menu", [], ["menu"]),
                        V("chá", "tea"),
                        V("cerveja", "beer"),
                        V("vinho", "wine"),
                        V("mesa", "table"),
                        V("sumo", "juice"),
                    ],
                    "sentences": [
                        S("Um café, por favor.", "A coffee, please.", ["One coffee, please."]),
                        S("A conta, por favor.", "The bill, please.", ["The check, please."]),
                        S("Uma mesa para dois.", "A table for two."),
                        S("Queria um chá com leite.", "I would like a tea with milk.", ["I would like tea with milk.", "I want a tea with milk.", "I want tea with milk."], ["Quero um chá com leite."]),
                        S("Quanto custa?", "How much is it?", ["How much does it cost?"], ["Quanto é?"]),
                        S("O vinho é muito bom.", "The wine is very good."),
                        S("Para mim, uma cerveja.", "For me, a beer.", ["A beer for me."]),
                    ],
                },
                {
                    "title": "Days and time",
                    "icon": "calendar",
                    "tip": "Weekdays are numbered: 'segunda-feira' is Monday (the 'second day'). People often shorten them: 'segunda', 'terça'…",
                    "vocab": [
                        V("segunda-feira", "Monday", [], ["segunda"]),
                        V("terça-feira", "Tuesday", [], ["terça"]),
                        V("quarta-feira", "Wednesday", [], ["quarta"]),
                        V("quinta-feira", "Thursday", [], ["quinta"]),
                        V("sexta-feira", "Friday", [], ["sexta"]),
                        V("sábado", "Saturday"),
                        V("domingo", "Sunday"),
                        V("hoje", "today"),
                        V("amanhã", "tomorrow"),
                        V("semana", "week"),
                    ],
                    "sentences": [
                        S("Hoje é segunda-feira.", "Today is Monday.", ["It is Monday today."], ["Hoje é segunda."]),
                        S("Amanhã é sábado.", "Tomorrow is Saturday."),
                        S("Trabalho na sexta-feira.", "I work on Friday.", ["I am working on Friday.", "I work Friday.", "I am working Friday."], ["Trabalho na sexta.", "Eu trabalho na sexta-feira."]),
                        S("Que horas são?", "What time is it?"),
                        S("É uma hora.", "It is one o'clock.", ["It is one.", "It is 1 o'clock.", "It is 1."], ["É uma."]),
                        S("Até domingo.", "See you on Sunday.", ["See you Sunday.", "Until Sunday."]),
                        S("A semana tem sete dias.", "The week has seven days.", ["A week has seven days.", "The week has 7 days.", "A week has 7 days."]),
                    ],
                },
            ],
        },
    ],
}

PUNCT = ".,!?¿¡;:\"“”«»"


def tokens(s):
    out = []
    for raw in s.split():
        t = raw.strip(PUNCT)
        if t:
            out.append(t)
    return out


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("-", " ")
    s = re.sub(r"[^a-z0-9\s']", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def norm_keep_accents(s):
    # Accents matter here: "te" is not "té" (tea) and "el" is not "él" (he).
    s = unicodedata.normalize("NFC", s.lower()).replace("-", " ")
    s = re.sub(r"[^\w\s']", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def cap(s):
    return s[0].upper() + s[1:] if s else s


def words_in(text, vocab):
    """Vocabulary items (target form) that appear in a target-language text."""
    n = " " + norm_keep_accents(text) + " "
    found = []
    for v in vocab:
        for form in [v["t"]] + v["talt"]:
            if " " + norm_keep_accents(form) + " " in n:
                found.append(v["t"])
                break
    return found


class Builder:
    def __init__(self, course, rng):
        self.c = course
        self.rng = rng
        self.allvocab = [v for u in course["units"] for sk in u["skills"] for v in sk["vocab"]]

    def tag(self, text):
        """SRS keys for a sentence: course vocabulary it contains, else the sentence itself."""
        found = words_in(text, self.allvocab)
        return found or [text]

    def shuffled(self, items):
        items = list(items)
        self.rng.shuffle(items)
        return items

    def mc_vocab(self, v, vocab, direction):
        # Skip distractors that collapse to the same text without accents (avó / avô).
        others = [x for x in vocab if x is not v and norm(x["t"]) != norm(v["t"]) and norm(x["e"]) != norm(v["e"])]
        picks = self.rng.sample(others, 3)
        if direction == "t2e":
            opts = [cap(v["e"])] + [cap(x["e"]) for x in picks]
            return {
                "type": "mc",
                "instruction": "What does this mean?",
                "prompt": v["t"],
                "promptLang": "target",
                "options": self.shuffled(opts),
                "answer": cap(v["e"]),
                "words": [v["t"]],
            }
        opts = [v["t"]] + [x["t"] for x in picks]
        return {
            "type": "mc",
            "instruction": "Pick the correct translation",
            "prompt": cap(v["e"]),
            "promptLang": "en",
            "options": self.shuffled(opts),
            "answer": v["t"],
            "words": [v["t"]],
        }

    def mc_sentence(self, s, sentences, vocab):
        others = [x for x in sentences if x is not s]
        picks = self.rng.sample(others, 3)
        opts = [s["e"]] + [x["e"] for x in picks]
        return {
            "type": "mc",
            "instruction": "What does this sentence mean?",
            "prompt": s["t"],
            "promptLang": "target",
            "options": self.shuffled(opts),
            "answer": s["e"],
            "words": self.tag(s["t"]),
        }

    def match(self, items):
        return {
            "type": "match",
            "instruction": "Match the pairs",
            "pairs": [[v["t"], cap(v["e"])] for v in items],
            "words": [v["t"] for v in items],
        }

    def _distractor_tiles(self, answer_tokens, pool_sentences, key, n=3):
        have = {t.lower() for t in answer_tokens}
        pool = []
        for s in pool_sentences:
            for t in tokens(s[key]):
                if t.lower() not in have and t.lower() not in {p.lower() for p in pool}:
                    pool.append(t)
        self.rng.shuffle(pool)
        return pool[:n]

    def tap_target(self, s, sentences, vocab):
        ans = tokens(s["t"])
        extra = self._distractor_tiles(ans, [x for x in sentences if x is not s], "t")
        return {
            "type": "tap",
            "instruction": "Build the sentence in " + self.c["shortName"],
            "prompt": s["e"],
            "promptLang": "en",
            "tiles": self.shuffled(ans + extra),
            "answer": ans,
            "accepted": s["talt"],
            "words": self.tag(s["t"]),
        }

    def tap_english(self, s, sentences, vocab):
        ans = tokens(s["e"])
        extra = self._distractor_tiles(ans, [x for x in sentences if x is not s], "e")
        return {
            "type": "tap",
            "instruction": "Build the sentence in English",
            "prompt": s["t"],
            "promptLang": "target",
            "tiles": self.shuffled(ans + extra),
            "answer": ans,
            "accepted": s["ealt"],
            "words": self.tag(s["t"]),
        }

    def type_t2e(self, item, vocab, is_vocab=False):
        answers = [cap(item["e"])] + [cap(a) for a in item["ealt"]]
        return {
            "type": "type",
            "instruction": "Type this in English",
            "prompt": item["t"],
            "promptLang": "target",
            "answers": answers,
            "words": [item["t"]] if is_vocab else self.tag(item["t"]),
        }

    def type_e2t(self, item, vocab, is_vocab=False):
        return {
            "type": "type",
            "instruction": "Type this in " + self.c["shortName"],
            "prompt": cap(item["e"]),
            "promptLang": "en",
            "answers": [item["t"]] + item["talt"],
            "words": [item["t"]] if is_vocab else self.tag(item["t"]),
        }

    def listen(self, s, vocab):
        return {
            "type": "listen",
            "instruction": "Type what you hear",
            "text": s["t"],
            "translation": s["e"],
            "answers": [s["t"]],
            "words": self.tag(s["t"]),
        }

    def lessons_for_skill(self, skill):
        v, s = skill["vocab"], skill["sentences"]
        assert len(v) >= 8 and len(s) == 7, skill["title"]
        L1 = [
            self.mc_vocab(v[0], v, "t2e"),
            self.mc_vocab(v[1], v, "t2e"),
            self.mc_vocab(v[2], v, "e2t"),
            self.mc_vocab(v[3], v, "t2e"),
            self.match(v[0:4]),
            self.tap_target(s[0], s, v),
            self.listen(s[1], v),
            self.tap_english(s[2], s, v),
            self.type_t2e(s[0], v),
        ]
        L2 = [
            self.mc_vocab(v[4], v, "t2e"),
            self.mc_vocab(v[5], v, "e2t"),
            self.mc_vocab(v[6], v, "t2e"),
            self.mc_vocab(v[7], v, "e2t"),
            self.match(v[4:8]),
            self.tap_target(s[3], s, v),
            self.tap_english(s[4], s, v),
            self.listen(s[3], v),
            self.type_t2e(s[5], v),
            self.type_e2t(v[0], v, is_vocab=True),
        ]
        extra = v[8:] if len(v) > 8 else [v[1]]
        review = self.rng.sample(v, 5)
        L3 = [
            self.mc_sentence(s[6], s, v),
            self.mc_vocab(extra[0], v, "t2e"),
            self.match(review),
            self.tap_target(s[6], s, v),
            self.tap_english(s[1], s, v),
            self.listen(s[5], v),
            self.type_e2t(s[4], v),
            self.type_t2e(s[2], v),
            self.type_e2t(extra[-1], v, is_vocab=True),
            self.tap_target(s[5], s, v),
        ]
        return [L1, L2, L3]


def build(course):
    rng = random.Random("lingualoop:" + course["id"])
    short = course["title"].split(" ")[0]
    course["shortName"] = short
    b = Builder(course, rng)
    outdir = os.path.join(ROOT, course["id"])
    os.makedirs(outdir, exist_ok=True)
    unit_files = []
    for ui, unit in enumerate(course["units"], start=1):
        uid = "u%d" % ui
        skills_out = []
        for si, skill in enumerate(unit["skills"], start=1):
            sid = "%ss%d" % (uid, si)
            lessons = b.lessons_for_skill(skill)
            skills_out.append({
                "id": sid,
                "title": skill["title"],
                "icon": skill["icon"],
                "tip": skill["tip"],
                "lessons": [
                    {"id": "%sl%d" % (sid, li), "title": "Lesson %d" % li, "exercises": ex}
                    for li, ex in enumerate(lessons, start=1)
                ],
            })
        fname = "unit%d.json" % ui
        unit_files.append(fname)
        with open(os.path.join(outdir, fname), "w", encoding="utf-8") as f:
            json.dump({"id": uid, "title": unit["title"], "description": unit["description"], "skills": skills_out}, f, ensure_ascii=False, indent=2)
            f.write("\n")
    meta = {
        "id": course["id"],
        "title": course["title"],
        "shortName": short,
        "nativeName": course["nativeName"],
        "fromLanguage": "en",
        "speechLang": course["speechLang"],
        "description": course["description"],
        "units": unit_files,
    }
    with open(os.path.join(outdir, "course.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write("\n")


if __name__ == "__main__":
    for c in (SPANISH, PORTUGUESE):
        build(c)
    print("Content written to", os.path.normpath(ROOT))
