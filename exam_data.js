document.addEventListener('DOMContentLoaded', async () => {
    const contentDiv = document.getElementById('content');
    const downloadBtn = document.getElementById('download-json');
    
    async function loadAndDisplayData() {
        try {
            const data = await browser.storage.local.get({ currentExamData: null });
            
            if (!data.currentExamData || !data.currentExamData.props || !data.currentExamData.props.examQuestions) {
                contentDiv.innerHTML = '<p>Aucune donnée d\'examen récente trouvée. Assurez-vous d\'être sur une page d\'activité GlobalExam active.</p>';
                return;
            }

            const examData = data.currentExamData;
            const questions = examData.props.examQuestions.data;
            const assetsBaseUrl = "https://assets.global-exam.com/";

            contentDiv.innerHTML = '';

            // Setup Download button
            const jsonString = JSON.stringify(examData, null, 2);
            downloadBtn.style.display = 'inline-block';
            
            // Fix: Check if downloadBtn has a parentNode before replacing child
            if (downloadBtn.parentNode) {
                const newDownloadBtn = downloadBtn.cloneNode(true);
                downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
                
                newDownloadBtn.addEventListener('click', () => {
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `global_exam_data_${new Date().getTime()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            } else {
                // Fallback if parentNode is somehow missing, just add the listener (might trigger multiple times on reload though)
                downloadBtn.onclick = () => {
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `global_exam_data_${new Date().getTime()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                };
            }

            // Helper to map letter to index
            const letterToIndex = {
                'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5
            };

            // === BUILD SUMMARY ===
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'summary-container';
            let summaryHtml = `<h2 class="summary-title">Synthèse des réponses</h2><ul class="summary-list">`;
            
            questions.forEach((q, index) => {
                let questionTitle = q.name || q.title || q.label || `Question ${index + 1}`;
                
                let correctAnswerText = "Réponse introuvable";
                let correctIndexFromExplanation = -1;

                if (q.translations && q.translations.explanation) {
                     const match = q.translations.explanation.match(/<p>\s*\(([A-Z])\)/i);
                     if (match && match[1]) {
                         const letter = match[1].toUpperCase();
                         if (letterToIndex[letter] !== undefined) {
                             correctIndexFromExplanation = letterToIndex[letter];
                         }
                     }
                }

                if (q.exam_answers) {
                    q.exam_answers.forEach((ans, ansIndex) => {
                        const answerText = ans.name || ans.text || ans.content || ans.label || ans.value || ans.id;
                        let isCorrect = ans.is_right_answer;
                        
                        if (isCorrect === undefined) {
                             if (correctIndexFromExplanation !== -1) {
                                 isCorrect = (ansIndex === correctIndexFromExplanation);
                             } else if (q.translations && q.translations.explanation) {
                                 isCorrect = q.translations.explanation.includes(answerText);
                             }
                        }
                        
                        if (isCorrect) {
                            correctAnswerText = answerText;
                        }
                    });
                }
                
                // Strip HTML tags from question for cleaner summary
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = questionTitle;
                const cleanQuestion = tempDiv.textContent || tempDiv.innerText || "";
                
                const tempAnsDiv = document.createElement('div');
                tempAnsDiv.innerHTML = correctAnswerText;
                const cleanAnswer = tempAnsDiv.textContent || tempAnsDiv.innerText || "";

                summaryHtml += `
                    <li class="summary-item">
                        <div class="summary-question">Q${index + 1} : ${cleanQuestion}</div>
                        <div class="summary-answer">${cleanAnswer}</div>
                    </li>
                `;
            });
            summaryHtml += `</ul>`;
            summaryDiv.innerHTML = summaryHtml;
            contentDiv.appendChild(summaryDiv);
            // === END SUMMARY ===


            // 1. Support Media and Transcript (from examPart)
            let mainContentHtml = '';
            if (examData.props.examPart && examData.props.examPart.data && examData.props.examPart.data.exam_supports) {
                 examData.props.examPart.data.exam_supports.forEach(support => {
                      if (support.media && support.media.file_url) {
                           const mediaUrl = support.media.file_url.startsWith('http') ? support.media.file_url : assetsBaseUrl + support.media.file_url;
                           if (support.media_format_code === "AUDIO") {
                               mainContentHtml += `
                                   <div class="media-container" style="margin-bottom: 20px;">
                                       <p><strong>Audio principal :</strong></p>
                                       <audio controls style="width: 100%;">
                                           <source src="${mediaUrl}" type="audio/mpeg">
                                           Votre navigateur ne supporte pas la balise audio.
                                       </audio>
                                   </div>`;
                           } else if (support.media_format_code === "IMAGE") {
                               mainContentHtml += `
                                   <div class="media-container">
                                       <img src="${mediaUrl}" alt="Support media" style="max-width: 100%; border-radius: 8px;" />
                                   </div>`;
                           }
                      }
                      
                      if (support.transcript && support.transcript.length > 0) {
                          support.transcript.forEach(t => {
                              if (t.content) {
                                  mainContentHtml += `<div style="margin-top: 15px; background: #e9ecef; padding: 15px; border-left: 4px solid #007bff; border-radius: 4px;"><strong>Transcription :</strong><br/>${t.content}</div>`;
                              }
                          });
                      }
                 });
            }
            
            if (mainContentHtml) {
                 const mainDiv = document.createElement('div');
                 mainDiv.className = 'question-container';
                 mainDiv.innerHTML = `<h2>Support de l'activité</h2>${mainContentHtml}`;
                 contentDiv.appendChild(mainDiv);
            }


            // 2. Detailed Questions and Answers
            questions.forEach((q, index) => {
                const questionDiv = document.createElement('div');
                questionDiv.className = 'question-container';

                // Question Text
                let questionTitle = q.name || q.title || q.label || `Question ${index + 1}`;
                let qHtml = `<div class="question-text">Question ${index + 1} : ${questionTitle}</div>`;

                // Question Media (if any specific to the question)
                if (q.media && q.media.file_url) {
                     const qMediaUrl = q.media.file_url.startsWith('http') ? q.media.file_url : assetsBaseUrl + q.media.file_url;
                     if (q.media_format_code === "IMAGE") {
                         qHtml += `<div class="media-container"><img src="${qMediaUrl}" alt="Media de la question" style="max-width: 100%;"/></div>`;
                     } else if (q.media_format_code === "AUDIO") {
                         qHtml += `<div class="media-container"><audio controls><source src="${qMediaUrl}" type="audio/mpeg"></audio></div>`;
                     }
                }

                // Explanation (contains hints for the correct answer in this specific JSON structure)
                let explanationText = "";
                let correctIndexFromExplanation = -1;

                if (q.translations && q.translations.explanation) {
                     explanationText = q.translations.explanation;
                     qHtml += `<div style="margin-bottom: 15px; background: #fff3cd; padding: 10px; border-radius: 4px; font-size: 0.9em; border-left: 4px solid #ffc107;">
                                 <strong>Explication & Solution :</strong> ${explanationText}
                               </div>`;
                     
                     // Regex to extract the first (A), (B), (C) etc. from the explanation paragraph
                     const match = explanationText.match(/<p>\s*\(([A-Z])\)/i);
                     if (match && match[1]) {
                         const letter = match[1].toUpperCase();
                         if (letterToIndex[letter] !== undefined) {
                             correctIndexFromExplanation = letterToIndex[letter];
                         }
                     }
                }

                // Answers
                qHtml += `<ul class="answers-list">`;
                if (q.exam_answers) {
                    q.exam_answers.forEach((ans, ansIndex) => {
                        const answerText = ans.name || ans.text || ans.content || ans.label || ans.value || ans.id;
                        
                        let isCorrect = ans.is_right_answer; 
                        
                        if (isCorrect === undefined) {
                             if (correctIndexFromExplanation !== -1) {
                                 // Use the extracted index based on (A), (B), (C)...
                                 isCorrect = (ansIndex === correctIndexFromExplanation);
                             } else if (explanationText) {
                                 // Fallback to text inclusion
                                 isCorrect = explanationText.includes(answerText);
                             }
                        }

                        const ansClass = isCorrect ? 'answer-item correct' : 'answer-item';
                        const correctIcon = isCorrect ? ' ✔️' : '';
                        
                        qHtml += `<li class="${ansClass}">${answerText}${correctIcon}</li>`;
                    });
                } else {
                     qHtml += `<li>Aucune réponse trouvée.</li>`;
                }
                qHtml += `</ul>`;

                questionDiv.innerHTML = qHtml;
                contentDiv.appendChild(questionDiv);
            });

            // Add raw JSON data at the bottom with toggle functionality
            const rawDataDiv = document.createElement('div');
            rawDataDiv.className = 'raw-data-container';
            
            rawDataDiv.innerHTML = `
                <div class="raw-data-header" id="raw-data-header">
                    <h2 class="raw-data-title">Données JSON brutes (Débogage)</h2>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="raw-data-content" id="raw-data-content">
                    <pre><code>${jsonString}</code></pre>
                </div>
            `;
            contentDiv.appendChild(rawDataDiv);

            // Add toggle event listener
            const header = document.getElementById('raw-data-header');
            const content = document.getElementById('raw-data-content');
            const icon = header.querySelector('.toggle-icon');

            header.addEventListener('click', () => {
                if (content.style.display === 'block') {
                    content.style.display = 'none';
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'block';
                    icon.textContent = '▲';
                }
            });

        } catch (error) {
            console.error("Erreur lors de l'affichage des données:", error);
            contentDiv.innerHTML = `<p style="color:red;">Une erreur est survenue lors de la récupération des données : ${error.message}</p>`;
        }
    }

    // Initial load
    await loadAndDisplayData();

    // Listen for storage changes to update the page automatically
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.currentExamData) {
            console.log("Nouvelles données d'examen reçues, mise à jour de la page...");
            loadAndDisplayData();
        }
    });
});
