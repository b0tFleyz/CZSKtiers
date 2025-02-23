document.addEventListener('DOMContentLoaded', async function () {



    async function nactiExcel(nazevSouboru, idTabulky) {

        try {

            const response = await fetch(nazevSouboru);

            const data = await response.arrayBuffer();

            const workbook = XLSX.read(data, { type: 'array' });

            const worksheet = workbook.Sheets[workbook.SheetNames[0]];

            const html = XLSX.utils.sheet_to_html(worksheet);



            let table = document.getElementById(idTabulky);

            table.innerHTML = html;



            table.querySelector('tr:first-child').style.display = 'none';



            const rows = table.querySelectorAll('tbody tr');

            const newImageUrl = "https://cdn.discordapp.com/emojis/1266555790953676841.webp?size=96";



            rows.forEach(row => {

                if (idTabulky !== 'overall-tabulka') {

                    const prvniSloupec = row.querySelector('td:nth-child(1)');

                    if (prvniSloupec) {

                        prvniSloupec.style.display = 'none';

                    }

                    const druhySloupec = row.querySelector('td:nth-child(2)');

                    if (druhySloupec) {

                        druhySloupec.style.display = 'none';

                    }

                } else {

                    const uuidCell = row.querySelector('td:nth-child(3)');

                    if (uuidCell) {

                        const uuid = uuidCell.textContent;

                        const imageUrl = `https://render.crafty.gg/3d/bust/${uuid}`;



                        let imageCell = row.querySelector('td:nth-child(2)');

                        if (!imageCell) {

                            imageCell = document.createElement('td');

                            row.appendChild(imageCell);

                        }



                        const imgElement = document.createElement('img');

                        imgElement.src = imageUrl;

                        imgElement.alt = `Avatar hráče s UUID ${uuid}`;

                        imgElement.style.width = '80px';

                        imgElement.style.height = '80px';

                        imageCell.innerHTML = '';

                        imageCell.appendChild(imgElement);



                        let combinedCell = row.querySelector('td:nth-child(5)');

                        if (!combinedCell) {

                            combinedCell = document.createElement('td');

                            row.appendChild(combinedCell);

                        }



                        const currentNumberCell = row.querySelector('td:nth-child(5)');

                        const currentNumber = currentNumberCell ? currentNumberCell.textContent : '';



                        const newImgElement = document.createElement('img');

                        newImgElement.src = newImageUrl;

                        newImgElement.alt = "End Crystal";

                        newImgElement.style.width = '0px';

                        newImgElement.style.height = '0px';



                        combinedCell.innerHTML = '';

                        combinedCell.appendChild(document.createTextNode(currentNumber + ' '));

                        combinedCell.appendChild(newImgElement);

                    }

                }

            });



            nahradCislaVTabulce(idTabulky);

            return;

        } catch (error) {

            console.error("Chyba při načítání Excelu:", error);

        }

    }



    function nahradCislaVTabulce(idTabulky) {

        const tabulka = document.getElementById(idTabulky);

        if (!tabulka) {

            console.error("Tabulka s ID '" + idTabulky + "' nebyla nalezena.");

            return;

        }



        const bunky = tabulka.querySelectorAll("td");

        bunky.forEach(bunka => {

            const hodnota = bunka.textContent.trim();

            let novyText = null;

            let barvaTextu = null;

            let barvaPozadi = null;



            switch (hodnota) {

                case "32": novyText = "HT2"; barvaTextu = "black"; barvaPozadi = "lightgray"; break;

                case "16": novyText = "HT3"; barvaTextu = "black"; barvaPozadi = "#CD853F"; break;

                case "10": novyText = "LT3"; barvaTextu = "black"; barvaPozadi = "#A0522D"; break;

                case "5": novyText = "HT4"; barvaTextu = "black"; barvaPozadi = "#EEE0CB"; break;

                case "3": novyText = "LT4"; barvaTextu = "black"; barvaPozadi = "#EEE0CB"; break;

                case "2": novyText = "HT5"; barvaTextu = "black"; barvaPozadi = "#EEE0CB"; break;

                case "1": novyText = "LT5"; barvaTextu = "black"; barvaPozadi = "#EEE0CB"; break;

                case "24": novyText = "LT2"; barvaTextu = "black"; barvaPozadi = "gray"; break;

                case "48": novyText = "LT1"; barvaTextu = "black"; barvaPozadi = "#FFFF00"; break;

                case "60": novyText = "HT1"; barvaTextu = "black"; barvaPozadi = "#FFFFE0"; break;

                case "22": novyText = "RTL2"; barvaTextu = "dimgray"; break;

                case "29": novyText = "RHT2"; barvaTextu = "gray"; break;

                case "43": novyText = "RTL1"; barvaTextu = "darkgoldenrod"; break;

                case "54": novyText = "RHT1"; barvaTextu = "gold"; break;

                default: barvaPozadi = "#EEE0CB"; break;

            }



            if (novyText !== null && bunka.cellIndex !== 0 && bunka.cellIndex !== 3) {

                bunka.textContent = novyText;

                bunka.style.color = barvaTextu;

                bunka.style.backgroundColor = barvaPozadi;



                if (bunka.cellIndex === 4) {

                    const img = document.createElement('img');

                    img.src = "https://cdn.discordapp.com/emojis/1266555790953676841.webp?size=40";

                    img.alt = novyText;

                    img.style.display = 'block';

                    bunka.appendChild(img);

                }



                if (bunka.cellIndex === 5) {

                    const img = document.createElement('img');

                    img.src = "https://cdn.discordapp.com/emojis/1341321180329676840.webp?size=40";

                    img.alt = novyText;

                    img.style.display = 'block';

                    bunka.appendChild(img);

                }



                if (bunka.cellIndex === 6) {

                    const img = document.createElement('img');

                    img.src = "https://cdn.discordapp.com/emojis/1266550161744724060.webp?size=40";

                    img.alt = novyText;

                    img.style.display = 'block';

                    bunka.appendChild(img);

                }

                if (bunka.cellIndex === 7) {

                    const img = document.createElement('img');

                    img.src = "https://cdn.discordapp.com/emojis/1341321583695892575.webp?size=40";

                    img.alt = novyText;

                    img.style.display = 'block';

                    bunka.appendChild(img);

                }

                if (bunka.cellIndex === 8) {

                    const img = document.createElement('img');

                    img.src = "https://cdn.discordapp.com/emojis/1266553596858732705.webp?size=40";

                    img.alt = novyText;

                    img.style.display = 'block';

                    bunka.appendChild(img);

                }

                if (bunka.cellIndex === 9) {

                    const img = document.createElement('img');

                    img.src = "https://cdn.discordapp.com/emojis/1299784615149437072.webp?size=40";

                    img.alt = novyText;

                    img.style.display = 'block';

                    bunka.appendChild(img);

                }

                if (bunka.cellIndex === 10) {

                    const img = document.createElement('img');

                    img.src = "https://cdn.discordapp.com/emojis/1266553957543579760.webp?size=40";

                    img.alt = novyText;

                    img.style.display = 'block';

                    bunka.appendChild(img);

                }

                if (bunka.cellIndex === 11) {

                    const img = document.createElement('img');

                    img.src = "https://cdn.discordapp.com/emojis/1335283642490032138.webp?size=40";

                    img.alt = novyText;

                    img.style.display = 'block';

                    bunka.appendChild(img);

                }

            }

        });

    }

    nactiExcel('https://docs.google.com/spreadsheets/d/1OIod_IOs0te98BKb5BvApmtwMVWojtaPCgx7FJZVh28/edit?usp=sharing', 'overall-tabulka');

    nactiExcel('https://docs.google.com/spreadsheets/d/1j_F6VyWnCrt6GQxtQDjdNyOYX2h4CXR8XMwRv8Dtanw/edit?usp=sharing', 'cpvp-tabulka');

    nactiExcel('https://docs.google.com/spreadsheets/d/1mkRA4irm2U4iWAtaM4GE-Cud3iZsaO-YU0AB8gvjhnM/edit?usp=sharing', 'axe-tabulka');

    nactiExcel('https://docs.google.com/spreadsheets/d/1x-CQwTa1UXPCAvEPGSS_pGmAEPA_BjEtSV2lLxyvHmc/edit?usp=sharing', 'sword-tabulka');

    nactiExcel('https://docs.google.com/spreadsheets/d/1pt1KCOXspTBCEj6C6q2bnCJBLj5VJG57rXQ1vHcAJwM/edit?usp=sharing', 'npot-tabulka');

    nactiExcel('https://docs.google.com/spreadsheets/d/19fgMlbGaQ716KUa8umsMHk0wTZFa0leAtGpIb_44iT0/edit?usp=sharing', 'pot-tabulka');

    nactiExcel('https://docs.google.com/spreadsheets/d/13OqD1PetWvu7IOn6vph06m8TmML5UsCvwmaVADT-kkg/edit?usp=sharing', 'smp-tabulka');

    nactiExcel('https://docs.google.com/spreadsheets/d/1C8Sa9pcGNzFR5gTR9lbcP9d9Wyhb9yIhx9GsCOtTfTg/edit?usp=sharing', 'uhc-tabulka');

    nactiExcel('https://docs.google.com/spreadsheets/d/1AgzOlXw6C-i1rwsDs3jA3Rg2QyN_O6ZqheiHENncWsI/edit?usp=sharing', 'diasmp-tabulka');



    function zobrazTabulku(idTabulky) {

        const vsechnyTabulky = document.querySelectorAll('.tabulka');

        vsechnyTabulky.forEach(tabulka => tabulka.classList.remove('active'));



        const vybranaTabulka = document.getElementById(idTabulky);

        if (vybranaTabulka) {

            vybranaTabulka.classList.add('active');

        }

    }



    const odkazy = document.querySelectorAll('nav a');

    odkazy.forEach(odkaz => {

        odkaz.addEventListener('click', function (event) {

            event.preventDefault();

            const idTabulky = this.getAttribute('href').substring(1) + '-tabulka';

            zobrazTabulku(idTabulky);

        });

    });



    zobrazTabulku('overall-tabulka');



});