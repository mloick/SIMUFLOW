"""
Fabrique les classeurs d'exemple fictifs de docs/exemples/ (lecture des
tableaux Excel). Aucune donnée réelle : services, groupes et situations sont
inventés. Lancer : python3 scripts/exemples-tableaux.py (demande openpyxl).
"""

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font

DOSSIER = Path(__file__).resolve().parent.parent / "docs" / "exemples"
GRAS = Font(bold=True)
RETOUR = Alignment(wrap_text=True, vertical="top")


def remplir(feuille, lignes):
    for ligne in lignes:
        feuille.append(ligne)
    for cellule in feuille[1]:
        cellule.font = GRAS
    for ligne in feuille.iter_rows():
        for cellule in ligne:
            cellule.alignment = RETOUR


def workflow():
    classeur = Workbook()
    entete = [
        "Famille", "Situation (menu déroulant)", "Explicite", "Champs du formulaire", "Propriétaire", "SLA",
        "Groupe de compétence 1", "Task 1", "OLA 1",
        "Groupe de compétence 2", "Task 2", "OLA 2", "Commentaires",
    ]
    financement = classeur.active
    financement.title = "Dossier de financement"
    remplir(financement, [
        entete,
        ["Famille X", "Cas 1", "Document manquant dans le dossier", "n° de dossier\ndescription libre", "Service P",
         "6 jours ouvrés", "Groupe A", "Task - Fournir le document",
         "3 jours ouvrés\n- Si pas de rep après 3JO alors création auto de la task étape 2",
         "Groupe B", "Task - Fournir le document", "3 jours ouvrés", "No answer = not solved"],
        [None, "Cas 2", "Contrat à corriger", "description libre", "Service P", "5 jours ouvrés", "Groupe C",
         "Task - Corriger le contrat", "5 jours ouvrés\n- Si pas de rep après 5JO clôture\n- Si Ok clôture service P",
         "Solved/Not solved/No answer : clôture ticket", "Clôture service P", "Service P reprend la main", None],
        [None, "Cas 3", "Accord préalable demandé", "n° de dossier", "Service P", "8 jours ouvrés", "Groupe A",
         "Task - Donner l'accord", "3 jours ouvrés\n- Si Ok après 3JO alors création auto de la task étape 2\n- Si pas Ok clôture",
         "Groupe D", "Task - Préparer le versement", "5 jours ouvrés", None],
        ["Famille Y", "Cas 4", "Montant à vérifier", "n° de dossier\nmontant", "Service Q", "4 jours ouvrés",
         "Groupe E + assignee manuel", "Task - Vérifier le montant", "3 jours ouvrés", "Groupe F",
         "Task - Vérifier le montant", "3 jours ouvrés", "SLA à confirmer"],
    ])
    financement.merge_cells("A2:A4")

    contrat = classeur.create_sheet("Contrat")
    remplir(contrat, [
        entete,
        ["Famille Z", "Cas 5", "Avenant à signer", "description libre", "Service R", "6 jours ouvrés", "Groupe G",
         "Task - Faire signer l'avenant",
         "3 jours ouvrés\n- Si pas de rep après 3JO alors création auto de la task étape 2",
         "Le service R reprend la main et clôturera après la résolution", None, None, "Reopen possible"],
        [None, "Cas 6", "Clause à revoir", "description libre", "Service R", "6 jours ouvrés", "Groupe H",
         "Task - Revoir la clause", "3 jours ouvrés\n- Si complexe alors création auto de la task étape 2",
         "Groupe I", "Task - Revoir la clause", "3 jours ouvrés", None],
    ])
    contrat.merge_cells("A2:A3")

    listes = classeur.create_sheet("Listes")
    remplir(listes, [["Groupes"], ["Groupe A"], ["Groupe B"], ["Groupe C"], ["Groupe D"], ["Groupe E"]])
    classeur.save(DOSSIER / "workflow-sla-ola.xlsx")


def template():
    """Même disposition qu'un vrai template : une colonne par question, une ligne par propriété."""
    classeur = Workbook()
    infos = classeur.active
    infos.title = "1 - Basic info"
    remplir(infos, [
        ["Informations de base sur le formulaire"],
        [None, "Instructions", "Your Value"],
        ["Ticket : Incident, Case ou Request", "Voir l'onglet Values", "Request"],
        ["Nom du formulaire visible", "Nom unique du formulaire", "Demande sur un dossier"],
        ["Description du formulaire", "Affichée sur la tuile du formulaire", "Signaler un problème sur un dossier"],
        ["Mots clés pour retrouver le formulaire", "Aident la recherche", "dossier, document, adresse"],
    ])
    remplir(classeur.create_sheet("2 - Location"), [
        ["Où le formulaire apparaît"], [None, "Instructions", "Your Value"], ["Category", "Rubrique du catalogue", "Dossiers"],
    ])
    questions = classeur.create_sheet("3 - Questions")
    lignes = [
        ["Questions posées au demandeur"],
        [None, "Instructions"] + [f"Question {n}" for n in range(1, 11)],
        ["Questions auxquelles le demandeur va répondre", "Nom de la question",
         "Coordonnées du demandeur", "Situation", "Êtes-vous le signataire du dossier ?",
         "Si NON : indiquer le signataire", "Quel changement souhaitez-vous ?",
         "MOTIF 1 : Indiquer la nouvelle adresse", "MOTIF 2 : Indiquer le nouveau contact",
         "Joindre le justificatif", "Date souhaitée", "Numéro de commande"],
        ["Format de la question", "Voir l'onglet Values",
         "Libellé", "Menu déroulant", "Oui/Non", "Libellé", "Case à cocher", "Texte sur plusieurs lignes",
         "Libellé", "Pièce jointe", "Date", "Texte sur une ligne"],
        ["Le demandeur est-il obligé d'y répondre ?", "Impossible d'envoyer sans les questions obligatoires",
         "oui", "oui", "oui", "oui", "oui", "oui", "oui", "oui", "non", "oui"],
        ["Explication de la question / Type", "Choix d'un menu déroulant ou de cases à cocher",
         "N° de dossier :\nNom :\nTéléphone :",
         "- Cas 1\n- Cas 2\n- Cas 3\n- Cas 4\n- Cas 5\n- Cas 6",
         None,
         "Nom du signataire :\nFonction :",
         "- MOTIF 1 : Changement d'adresse\n- MOTIF 2 : Changement de contact",
         None,
         "Nom du contact :\nTéléphone :\nEmail :",
         "Documents attendus :\n- Justificatif de domicile\n- Pièce d'identité",
         None, None],
        ["Conditions additionnelles et dépendances", "Afficher selon une autre réponse",
         None, None, None, None, None, None, None, None, None, "Si Question 2 = Cas 3"],
        ["Sous la question en italique : explications pour le demandeur", "Aide affichée sous la question",
         None, "Choisissez la situation qui correspond à votre demande", None, None,
         "Plusieurs choix possibles", None, None, "Un fichier PDF ou une photo", None, None],
        ["Exemples de réponses (optionnel)", "Disparaît dès que l'on écrit",
         None, None, None, None, None, "12 rue des Lilas, 75000 Ville", None, None, "05/12/2026", "C-0000"],
    ]
    remplir(questions, lignes)
    remplir(classeur.create_sheet("4 - Access"), [["Qui peut faire la demande"], [None, "Instructions", "Your Value"],
                                                  ["Disponible pour", "Public visé", "Tous les clients"]])
    remplir(classeur.create_sheet("5 - Fulfillment flow"), [
        ["Traitement de la demande"],
        [None, "Instructions", "Task 1", "Task 2"],
        ["Task Short Description", "Titre de la task", "Fournir le document", "Fournir le document"],
        ["Assignment Group", "Nom exact du groupe", "Groupe A", "Groupe B"],
        ["Sequence", "1, 2, ou 3a / 3b en parallèle", "1", "2"],
    ])
    remplir(classeur.create_sheet("6 - Assignment & Summary"), [
        ["Création du ticket"], [None, "Instructions", "Your Value"],
        ["Assignment Group", "Groupe propriétaire du ticket", "Service P"],
        ["Summary of Ticket", "Résumé du ticket créé", "Demande sur le dossier {N° de dossier}"],
    ])
    remplir(classeur.create_sheet("Values"), [
        ["Question Types (sheet 3 - Questions)"], ["Type de Question", "Quand l'utiliser"],
        ["Pièce jointe", "Un fichier"], ["Case à cocher", "Plusieurs choix"], ["Date", "Un jour"],
        ["Libellé", "Un titre ou des champs à remplir"], ["Menu déroulant", "Un choix dans une liste"],
        ["Oui/Non", "Oui ou Non"], ["Texte sur une ligne", "160 caractères"], ["Texte sur plusieurs lignes", "Texte long"],
    ])
    classeur.save(DOSSIER / "template-formulaire.xlsx")


def process():
    classeur = Workbook()
    feuille = classeur.active
    feuille.title = "Demande de matériel"
    feuille.append(["Demande de matériel informatique"])
    feuille.append([])
    remplir(feuille, [
        ["N°", "Étape", "Acteur", "Délai", "Suite"],
        [1, "Saisir la demande", "Demandeur", "1 JO", 2],
        [2, "Valider la demande", "Manager", "2 JO", "oui → 3 ; non → 5"],
        [3, "Commander le matériel", "Service Achats", "5 JO", 4],
        [4, "Livrer le matériel", "Service Informatique", "3 JO", "fin"],
        [5, "Informer le demandeur", "Manager", "1 JO", "fin"],
    ])
    feuille["A1"].font = GRAS
    classeur.save(DOSSIER / "demande-materiel.xlsx")

    lignes = [
        "N°;Étape;Acteur;Délai;Suite",
        "1;Saisir la demande;Demandeur;1 JO;2",
        "2;Valider la demande;Manager;2 JO;\"oui → 3 ; non → 5\"",
        "3;Commander le matériel;Service Achats;5 JO;4",
        "4;Livrer le matériel;Service Informatique;3 JO;fin",
        "5;Informer le demandeur;Manager;1 JO;fin",
    ]
    (DOSSIER / "demande-materiel.csv").write_text("\n".join(lignes) + "\n", encoding="utf-8")


def a_completer():
    """Un tableau aux titres que l'app ne connaît pas : on choisit les colonnes à la main."""
    classeur = Workbook()
    feuille = classeur.active
    feuille.title = "Arrivée"
    remplir(feuille, [
        ["Intitulé", "Pilote", "Durée prévue", "Commentaire"],
        ["Préparer le poste", "Service Informatique", "2 JO", "Avant l'arrivée"],
        ["Créer les accès", "Service Informatique", "1 JO", None],
        ["Accueillir la personne", "Manager", "1 JO", "Premier jour"],
    ])
    classeur.save(DOSSIER / "tableau-a-completer.xlsx")


if __name__ == "__main__":
    workflow()
    template()
    process()
    a_completer()
