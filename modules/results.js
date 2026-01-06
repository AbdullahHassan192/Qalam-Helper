//ResultsModule - handles results data extraction and dashboard injection

const ResultsModule = {
    // Store credit hours for courses (courseId -> creditHours)
    creditHoursCache: {},

    // Load cache from localStorage
    loadCreditHoursCache() {
        try {
            const stored = localStorage.getItem('qh_credit_hours');
            if (stored) {
                this.creditHoursCache = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load credit hours cache:', e);
        }
    },

    // Save cache to localStorage
    saveCreditHoursCache() {
        try {
            localStorage.setItem('qh_credit_hours', JSON.stringify(this.creditHoursCache));
        } catch (e) {
            console.error('Failed to save credit hours cache:', e);
        }
    },

    // Parse and cache credit hours from course cards
    parseCreditHours() {
        // Dashboard cards
        document.querySelectorAll('.card').forEach(card => {
            const parentLink = card.parentElement;
            if (parentLink && parentLink.href) {
                const courseIdMatch = parentLink.href.match(/\/course\/info\/(\d+)/);
                if (courseIdMatch) {
                    const courseId = courseIdMatch[1];
                    const creditText = card.textContent.match(/Credits?\s*:\s*([\d.]+)/i);
                    if (creditText) {
                        this.creditHoursCache[courseId] = parseFloat(creditText[1]);
                    }
                }
            }
        });

        // Results page cards
        document.querySelectorAll('.md-card').forEach(card => {
            const link = card.querySelector('a[href*="/student/course/gradebook/"]');
            if (link) {
                const courseIdMatch = link.href.match(/\/gradebook\/(\d+)/);
                if (courseIdMatch) {
                    const courseId = courseIdMatch[1];
                    const creditText = card.textContent.match(/Credit Hours?\s*:\s*([\d.]+)/i);
                    if (creditText) {
                        this.creditHoursCache[courseId] = parseFloat(creditText[1]);
                    }
                }
            }
        });

        // Save to localStorage after parsing
        this.saveCreditHoursCache();
    },

    async fetchGradebookData(courseId) {
        try {
            const response = await fetch(`https://qalam.nust.edu.pk/student/course/gradebook/${courseId}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Check for lab component by looking for course section identifiers
            // Look for any text containing course code patterns like "CS-333-...-A-Lab)" or "...-Lecture)"
            const allLinks = doc.querySelectorAll('a');
            let hasLabCategories = false;
            let foundCourseLinks = [];
            
            allLinks.forEach(link => {
                const text = link.textContent.trim();
                // Look for patterns like "CS-333-Fall-25-SEECS/BSDS/2023F-A-Lab)" or similar
                if (text.match(/\([A-Z]{2,4}-\d{3}.*?-(Lab|Lecture)\)/i)) {
                    foundCourseLinks.push(text);
                    if (text.toLowerCase().includes('-lab)')) {
                        hasLabCategories = true;
                    }
                }
            });

            const parentRows = doc.querySelectorAll('.table-parent-row');

            let lectureObtainedMarks = 0;
            let lectureClassAvgMarks = 0;
            let lectureMaxMarks = 0;
            let labObtainedMarks = 0;
            let labClassAvgMarks = 0;
            let labMaxMarks = 0;

            parentRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 2) return;

                const badgeMatch = cells[0].querySelector('.uk-badge');
                const weight = badgeMatch ? QalamHelper.parseNumber(badgeMatch.textContent) : 0;

                const nameCell = cells[0].querySelector('a') || cells[0];
                const nameCellClone = nameCell.cloneNode(true);
                if (nameCellClone.querySelector) {
                    const badge = nameCellClone.querySelector('.uk-badge');
                    if (badge) badge.remove();
                }
                const categoryName = nameCellClone.textContent.trim();

                const studentPercentage = QalamHelper.parseNumber(cells[1].textContent);

                // Still check category name to determine if it's a lab category
                const isLab = categoryName.toLowerCase().includes('lab');

                if (weight > 0) {
                    if (isLab) {
                        labMaxMarks += weight;
                    } else {
                        lectureMaxMarks += weight;
                    }

                    let currentRow = row.nextElementSibling;

                    if (currentRow && currentRow.classList.contains('table-child-row')) {
                        const hasHeaders = currentRow.querySelectorAll('th').length > 0;
                        if (hasHeaders) {
                            currentRow = currentRow.nextElementSibling;
                        }
                    }

                    const dataRows = [];
                    while (currentRow && currentRow.classList.contains('table-child-row')) {
                        const tdCount = currentRow.querySelectorAll('td').length;
                        if (tdCount >= 4) {
                            dataRows.push(currentRow);
                        }
                        currentRow = currentRow.nextElementSibling;
                    }

                    let studentContribution = 0;
                    let categoryClassAvgContribution = 0;

                    if (dataRows.length > 0) {
                        let categoryClassAvgSum = 0;
                        let categoryStudentMarksSum = 0;
                        let categoryMaxMarksSum = 0;

                        dataRows.forEach(dataRow => {
                            const cells = dataRow.querySelectorAll('td');
                            if (cells.length >= 5) {
                                const maxMark = QalamHelper.parseNumber(cells[1].textContent);
                                const studentMark = QalamHelper.parseNumber(cells[2].textContent);
                                const classAvgMarks = QalamHelper.parseNumber(cells[3].textContent);

                                if (maxMark > 0) {
                                    categoryStudentMarksSum += studentMark;
                                    categoryClassAvgSum += classAvgMarks;
                                    categoryMaxMarksSum += maxMark;
                                }
                            }
                        });

                        if (categoryMaxMarksSum > 0) {
                            studentContribution = (categoryStudentMarksSum / categoryMaxMarksSum) * weight;
                            categoryClassAvgContribution = (categoryClassAvgSum / categoryMaxMarksSum) * weight;
                        }
                    } else if (studentPercentage > 0) {
                        studentContribution = (studentPercentage / 100) * weight;
                    }

                    if (isLab) {
                        labObtainedMarks += studentContribution;
                        labClassAvgMarks += categoryClassAvgContribution;
                    } else {
                        lectureObtainedMarks += studentContribution;
                        lectureClassAvgMarks += categoryClassAvgContribution;
                    }
                }
            });

            // Use credit hours to determine lecture/lab split
            const creditHours = this.creditHoursCache[courseId];
            let lectureWeight, labWeight;

            if (hasLabCategories && creditHours) {
                // Lab is always 1 credit hour, lecture is (total - 1)
                const lectureCreditHours = creditHours - 1;
                const labCreditHours = 1;
                
                lectureWeight = (lectureCreditHours / creditHours) * 100;
                labWeight = (labCreditHours / creditHours) * 100;
            } else if (hasLabCategories) {
                // Fallback if credit hours not found - use standard 2+1 (66.67/33.33)
                lectureWeight = 66.67;
                labWeight = 33.33;
            } else {
                // Pure lecture course
                lectureWeight = 100;
                labWeight = 0;
            }

            const studentAggregate = (lectureObtainedMarks * lectureWeight / 100) + (labObtainedMarks * labWeight / 100);
            const classAggregate = (lectureMaxMarks > 0 || labMaxMarks > 0)
                ? (lectureClassAvgMarks * lectureWeight / 100) + (labClassAvgMarks * labWeight / 100)
                : null;

            return {
                studentAggregate,
                classAggregate,
                lectureWeight,
                labWeight
            };
        } catch (error) {
            console.error('Failed to fetch gradebook data:', error);
            return null;
        }
    },

    async injectDashboardResults() {
        // First, parse and cache credit hours from all cards
        this.parseCreditHours();
        
        const courseCards = document.querySelectorAll('.card');
        
        for (const card of courseCards) {
            if (card.querySelector('.qh-results-widget')) continue;

            const cardBody = card.querySelector('.card-body');
            if (!cardBody) continue;

            // Only process cards that have attendance data
            const attendanceDiv = Array.from(cardBody.querySelectorAll('.uk-text-small'))
                .find(div => div.textContent.includes('Attendance:'));
            
            if (!attendanceDiv) continue;

            // The card is inside an <a> tag - get the parent link
            const parentLink = card.parentElement;
            if (!parentLink || !parentLink.href) {
                continue;
            }

            // Extract course ID from /student/course/info/XXXXX
            const courseIdMatch = parentLink.href.match(/\/course\/info\/(\d+)/);
            if (!courseIdMatch) {
                continue;
            }
            
            const courseId = courseIdMatch[1];

            const data = await this.fetchGradebookData(courseId);
            if (!data) {
                continue;
            }

            const { studentAggregate, classAggregate } = data;
            
            const delta = classAggregate ? studentAggregate - classAggregate : 0;
            const deltaColor = delta >= 0 ? '#10b981' : '#ef4444';
            const deltaSymbol = delta >= 0 ? '+' : '';

            const widget = QalamHelper.createElement('div', 'qh-results-widget');
            widget.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;';

            widget.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div style="flex: 1;">
                        <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">Overall Aggregate</div>
                        <div style="font-size: 18px; font-weight: 700; color: #1e293b; font-family: ui-monospace, monospace;">${QalamHelper.formatPercent(studentAggregate, 1)}%</div>
                    </div>
                    ${classAggregate ? `
                    <div style="flex: 1; text-align: right;">
                        <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">vs Avg</div>
                        <div style="font-size: 14px; font-weight: 700; color: ${deltaColor}; font-family: ui-monospace, monospace;">${deltaSymbol}${QalamHelper.formatPercent(Math.abs(delta), 1)}%</div>
                    </div>
                    ` : ''}
                </div>
            `;

            cardBody.appendChild(widget);

        }
    },

    async injectResultsSummary() {
        // First, parse and cache credit hours from all cards
        this.parseCreditHours();
        
        const courseCards = document.querySelectorAll('.md-card');
        
        // Continuously monitor and fix heights every 200ms
        setInterval(() => {
            const allCards = document.querySelectorAll('.md-card.qh-results-card');
            allCards.forEach(card => {
                const currentHeight = card.style.height;
                if (currentHeight && currentHeight !== 'auto') {
                    card.style.setProperty('height', 'auto', 'important');
                    card.style.setProperty('min-height', '160px', 'important');
                }
            });
        }, 200);

        for (const card of courseCards) {
            if (card.querySelector('.qh-results-summary')) {
                continue;
            }

            const link = card.querySelector('a[href*="/student/course/gradebook/"]');
            if (!link) {
                continue;
            }

            const courseIdMatch = link.href.match(/\/gradebook\/(\d+)/);
            if (!courseIdMatch) {
                continue;
            }

            const courseId = courseIdMatch[1];

            const courseName = card.querySelector('.md-list-heading');
            const courseNameText = courseName ? courseName.textContent.trim() : 'Unknown';

            const data = await this.fetchGradebookData(courseId);
            if (!data) {
                continue;
            }

            const { studentAggregate, classAggregate } = data;
            const delta = classAggregate ? studentAggregate - classAggregate : 0;
            const deltaClass = delta >= 0 ? 'uk-text-success' : 'uk-text-danger';
            const deltaSymbol = delta >= 0 ? '+' : '';

            const contentDiv = card.querySelector('div[style*="padding:2%"]');
            if (!contentDiv) {
                continue;
            }

            // Function to force height override - be aggressive about it
            const forceHeightOverride = () => {
                card.style.setProperty('height', 'auto', 'important');
                card.style.setProperty('min-height', '160px', 'important');
            };
            
            // Apply immediately
            forceHeightOverride();
            
            // Keep re-applying every 100ms to fight Qalam's script
            setInterval(forceHeightOverride, 100);
            
            card.classList.add('qh-results-card');

            const summaryDiv = QalamHelper.createElement('div', 'qh-results-summary');
            summaryDiv.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;';

            summaryDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div style="flex: 1;">
                        <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">Overall</div>
                        <div style="font-size: 14px; font-weight: 700; color: #1e293b; font-family: ui-monospace, monospace;">${QalamHelper.formatPercent(studentAggregate, 2)}%</div>
                    </div>
                    ${classAggregate ? `
                    <div style="flex: 1; text-align: right;">
                        <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">Avg</div>
                        <div style="font-size: 14px; font-weight: 700; color: #64748b; font-family: ui-monospace, monospace;">${QalamHelper.formatPercent(classAggregate, 2)}%</div>
                    </div>
                    ` : ''}
                </div>
                ${classAggregate ? `
                <div style="margin-top: 6px; text-align: center; padding: 4px; background: ${delta >= 0 ? '#ecfdf5' : '#fef2f2'}; border-radius: 4px;">
                    <span style="font-size: 10px; font-weight: 600; font-family: ui-monospace, monospace;" class="${deltaClass}">
                        ${delta >= 0 ? '↑' : '↓'} ${deltaSymbol}${QalamHelper.formatPercent(Math.abs(delta), 2)}%
                    </span>
                </div>
                ` : ''}
            `;

            contentDiv.appendChild(summaryDiv);
        }
    },

    init() {
        const page = QalamHelper.detectPage();
        
        // Always load credit hours cache from localStorage first
        this.loadCreditHoursCache();
        
        if (page === 'results') {
            setTimeout(() => this.injectResultsSummary(), 1500);
        }
        
        if (page === 'dashboard') {
            setTimeout(() => this.injectDashboardResults(), 2000);
        }
    }
};
