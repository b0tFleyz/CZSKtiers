document.addEventListener('DOMContentLoaded', function() {

    function nactiExcel(nazevSouboru, idTabulky) {
        fetch(nazevSouboru)
            .then(response => response.arrayBuffer())
            .then(data => {
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const html = XLSX.utils.sheet_to_html(worksheet);

                let table = document.getElementById(idTabulky);
                table.innerHTML = html;

                table.querySelector('tr:first-child').style.display = 'none';

                const rows = table.querySelectorAll('tbody tr');

                const newImageUrl = "https://cdn.discordapp.com/emojis/1266555790953676841.webp?size=96"; // URL obrazku End Crystal

                rows.forEach(row => {
                    const uuidCell = row.querySelector('td:nth-child(3)'); // UUID je ve třetím sloupci
                    if (uuidCell) {
                        const uuid = uuidCell.textContent;
                        const imageUrl = `https://render.crafty.gg/3d/bust/${uuid}`; // Původní URL

                        let imageCell = row.querySelector('td:nth-child(2)'); // Původní obrázek do druhého sloupce
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

                        let combinedCell = row.querySelector('td:nth-child(6)'); // Kombinace do šestého sloupce
                        if (!combinedCell) {
                            combinedCell = document.createElement('td');
                            row.appendChild(combinedCell);
                        }

                        const currentNumberCell = row.querySelector('td:nth-child(6)'); // Číslo ze šestého sloupce
                        const currentNumber = currentNumberCell ? currentNumberCell.textContent : '';

                        const newImgElement = document.createElement('img');
                        newImgElement.src = newImageUrl;
                        newImgElement.alt = "End Crystal";
                        newImgElement.style.width = '30px';
                        newImgElement.style.height = '30px';

                        combinedCell.innerHTML = '';
                        combinedCell.appendChild(document.createTextNode(currentNumber + ' '));
                        combinedCell.appendChild(newImgElement);
                    }
                });

            });
    }

    nactiExcel('https://docs.google.com/spreadsheets/d/1OIod_IOs0te98BKb5BvApmtwMVWojtaPCgx7FJZVh28/edit?usp=sharing', 'overall-tabulka');
    nactiExcel('cpvp.xlsx', 'cpvp-tabulka');
    nactiExcel('axe.xlsx', 'axe-tabulka');
    nactiExcel('sword.xlsx', 'sword-tabulka');
    nactiExcel('npot.xlsx', 'npot-tabulka');
    nactiExcel('pot.xlsx', 'pot-tabulka');
    nactiExcel('smp.xlsx', 'smp-tabulka');
    nactiExcel('uhc.xlsx', 'uhc-tabulka');
    nactiExcel('diasmp.xlsx', 'diasmp-tabulka');

});