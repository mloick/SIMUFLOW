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
    classeur = Workbook()
    infos = classeur.active
    infos.title = "1. Basic info"
    remplir(infos, [["Champ", "Valeur"], ["Nom", "Demande sur un dossier"], ["Description", "Formulaire fictif"],
                    ["Mots-clés", "dossier, financement"]])
    remplir(classeur.create_sheet("2. Catalog location"), [["Catégorie", "Sous-catégorie"], ["Finance", "Dossiers"]])
    remplir(classeur.create_sheet("3. Questions"), [
        ["Question", "Type", "Obligatoire", "Valeurs", "Texte d'aide"],
        ["Situation", "Menu déroulant", "Oui", "Cas 1, Cas 2, Cas 3", "Choisissez la situation"],
        ["N° de dossier", "Texte", "Oui", None, "Format D-0000"],
        ["Description", "Texte long", "Non", None, None],
    ])
    remplir(classeur.create_sheet("4. Access"), [["Qui peut demander", "Tous les salariés"]])
    remplir(classeur.create_sheet("5. Fulfillment flow"), [
        ["Task", "Groupe", "Séquence"], ["Fournir le document", "Groupe A", "1"], ["Fournir le document", "Groupe B", "2"],
    ])
    remplir(classeur.create_sheet("6. Assignment & Summary"), [
        ["Owner", "Service P"], ["Résumé", "Demande sur le dossier {n° de dossier}"],
    ])
    remplir(classeur.create_sheet("7. Values"), [["Valeur"], ["Cas 1"], ["Cas 2"], ["Cas 3"]])
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


if __name__ == "__main__":
    workflow()
    template()
    process()
