// GradebookModule - handles gradebook data extraction and analytics

const GradebookModule = {
    detectCourseStructure() {
        // Check tab dropdown for Lab/Lecture sections 
        const tabDropdownItems = document.querySelectorAll('.uk-tab-responsive .uk-dropdown a');
        let hasLab = false;
        let hasLecture = false;
        
        tabDropdownItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes('-lab)') || text.includes('lab)')) hasLab = true;
            if (text.includes('-lecture)') || text.includes('lecture)')) hasLecture = true;
        });
        
        // Fallback: Check if there are Lab/Lecture tabs (old method)
        if (!hasLab && !hasLecture) {
            const tabs = document.querySelectorAll('.uk-tab li');
            tabs.forEach(tab => {
                const text = tab.textContent.toLowerCase();
                if (text.includes('lab')) hasLab = true;
                if (text.includes('lecture')) hasLecture = true;
            });
        }
        
        // Try to get credit hours from the page first
        let creditText = document.body.textContent.match(/Credit Hours?\s*:\s*([\d.]+)/i);
        let creditHours = creditText ? parseFloat(creditText[1]) : null;
        
        // If not found on page, try to get from URL and check ResultsModule cache
        if (!creditHours) {
            const urlMatch = window.location.href.match(/\/gradebook\/(\d+)/);
            if (urlMatch && ResultsModule && ResultsModule.creditHoursCache) {
                const courseId = urlMatch[1];
                creditHours = ResultsModule.creditHoursCache[courseId];
            }
        }
        
        let lectureWeight, labWeight;
        
        if (hasLab && hasLecture && creditHours) {
            // Use credit hours to determine split (Lab is always 1 credit)
            const lectureCreditHours = creditHours - 1;
            lectureWeight = (lectureCreditHours / creditHours) * 100;
            labWeight = (1 / creditHours) * 100;
        } else if (hasLab && hasLecture) {
            // Fallback to standard 2+1 split
            lectureWeight = 66.67;
            labWeight = 33.33;
        } else {
            // Pure lecture
            lectureWeight = 100;
            labWeight = 0;
        }
        
        return {
            hasLab,
            hasLecture,
            lectureWeight,
            labWeight
        };
    },

    extractAllCategoryData() {
        const allCategories = [];
        const tabContainers = document.querySelectorAll('#tabs_anim1 > li');
        
        if (tabContainers.length > 1) {
            tabContainers.forEach((container) => {
                const parentRows = container.querySelectorAll('.table-parent-row');
                if (parentRows.length === 0) return;
                
                let portionType = 'lecture';
                const firstCell = parentRows[0]?.querySelector('td a, td');
                if (firstCell) {
                    const firstCategoryText = firstCell.textContent.toLowerCase();
                    if (firstCategoryText.includes('lab')) {
                        portionType = 'lab';
                    }
                }
                
                const categories = this.extractCategoriesFromRows(parentRows, portionType, false);
                allCategories.push(...categories);
            });
            
            const visibleRows = document.querySelectorAll('.table-parent-row');
            if (visibleRows.length > 0) {
                const activeTab = document.querySelector('.uk-tab li.uk-active');
                let activePortionType = 'lecture';
                if (activeTab) {
                    const text = activeTab.textContent.toLowerCase();
                    activePortionType = text.includes('lab') ? 'lab' : 'lecture';
                }
                
                visibleRows.forEach(row => {
                    const categoryCell = row.querySelector('td');
                    if (!categoryCell) return;
                    
                    const categoryLink = categoryCell.querySelector('a');
                    let visibleName = '';
                    
                    if (categoryLink) {
                        const linkClone = categoryLink.cloneNode(true);
                        const badge = linkClone.querySelector('.uk-badge');
                        if (badge) badge.remove();
                        visibleName = linkClone.textContent.trim();
                    } else {
                        visibleName = categoryCell.textContent.trim();
                    }
                    
                    const cat = allCategories.find(c => 
                        c.name === visibleName && c.portionType === activePortionType
                    );
                    if (cat) {
                        cat.row = row;
                    }
                });
            }
        } else {
            const parentRows = document.querySelectorAll('.table-parent-row');
            const categories = this.extractCategoriesFromRows(parentRows, 'lecture', true);
            allCategories.push(...categories);
        }
        
        return allCategories;
    },

    extractCategoriesFromRows(parentRows, portionType, storeRows = false) {
        const categories = [];
        
        parentRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;

            const categoryCell = cells[0];
            const categoryLink = categoryCell.querySelector('a');
            let categoryName = '';
            
            if (categoryLink) {
                const linkClone = categoryLink.cloneNode(true);
                const badge = linkClone.querySelector('.uk-badge');
                if (badge) badge.remove();
                categoryName = linkClone.textContent.trim();
            } else {
                categoryName = categoryCell.textContent.trim();
            }
            
            const badgeMatch = categoryCell.querySelector('.uk-badge');
            const weight = badgeMatch ? QalamHelper.parseNumber(badgeMatch.textContent) : 0;

            const percentageCell = cells[1];
            const studentPercentage = QalamHelper.parseNumber(percentageCell.textContent);

            const childRows = this.getChildRows(row);
            const classAverages = [];
            const studentPercentages = [];

            childRows.forEach(childRow => {
                const childCells = childRow.querySelectorAll('td');
                if (childCells.length >= 5) {
                    const maxMark = QalamHelper.parseNumber(childCells[1].textContent);
                    const classAvgMarks = QalamHelper.parseNumber(childCells[3].textContent);
                    const studPercent = QalamHelper.parseNumber(childCells[4].textContent);
                    
                    if (maxMark === 0 && classAvgMarks === 0 && studPercent === 0) {
                        return;
                    }
                    
                    if (maxMark > 0 && classAvgMarks >= 0) {
                        const classAvgPercent = (classAvgMarks / maxMark) * 100;
                        classAverages.push(classAvgPercent);
                    }
                    
                    if (studPercent > 0) {
                        studentPercentages.push(studPercent);
                    }
                }
            });

            const classAvg = classAverages.length > 0 
                ? classAverages.reduce((a, b) => a + b, 0) / classAverages.length 
                : 0;

            let finalStudentPercentage = studentPercentage;
            if (studentPercentage === 0 && studentPercentages.length > 0) {
                finalStudentPercentage = studentPercentages.reduce((a, b) => a + b, 0) / studentPercentages.length;
            }

            const delta = classAvg > 0 ? finalStudentPercentage - classAvg : 0;

            const category = {
                name: categoryName,
                weight,
                studentPercentage: finalStudentPercentage,
                contribution: (finalStudentPercentage / 100) * weight,
                classAverage: classAvg,
                delta: delta,
                hasData: finalStudentPercentage > 0 || classAvg > 0,
                row: storeRows ? row : null,
                portionType: portionType
            };

            categories.push(category);
        });

        return categories;
    },

    getChildRows(parentRow) {
        const childRows = [];
        let nextRow = parentRow.nextElementSibling;
        
        while (nextRow && nextRow.classList.contains('table-child-row')) {
            childRows.push(nextRow);
            nextRow = nextRow.nextElementSibling;
        }
        
        return childRows;
    },

    calculateTotals(categories, courseStructure) {
        const lectureCategories = categories.filter(c => c.portionType === 'lecture');
        const labCategories = categories.filter(c => c.portionType === 'lab');
        
        let lectureStudentTotal = 0;
        let lectureClassTotal = 0;
        let lectureTotalWeight = 0;
        
        lectureCategories.forEach(cat => {
            if (cat.hasData) {
                lectureStudentTotal += cat.contribution;
                lectureTotalWeight += cat.weight;
                
                if (cat.classAverage > 0) {
                    lectureClassTotal += (cat.classAverage / 100) * cat.weight;
                }
            }
        });
        
        let labStudentTotal = 0;
        let labClassTotal = 0;
        let labTotalWeight = 0;
        
        labCategories.forEach(cat => {
            if (cat.hasData) {
                labStudentTotal += cat.contribution;
                labTotalWeight += cat.weight;
                
                if (cat.classAverage > 0) {
                    labClassTotal += (cat.classAverage / 100) * cat.weight;
                }
            }
        });
        
        const overallStudentTotal = 
            (lectureStudentTotal * courseStructure.lectureWeight / 100) +
            (labStudentTotal * courseStructure.labWeight / 100);
        
        const overallClassTotal = 
            (lectureClassTotal * courseStructure.lectureWeight / 100) +
            (labClassTotal * courseStructure.labWeight / 100);

        return {
            overall: {
                studentTotal: overallStudentTotal,
                classTotal: overallClassTotal,
                delta: overallStudentTotal - overallClassTotal
            },
            lecture: {
                studentTotal: lectureStudentTotal,
                classTotal: lectureClassTotal,
                delta: lectureStudentTotal - lectureClassTotal,
                totalWeight: lectureTotalWeight,
                gradedWeight: lectureTotalWeight
            },
            lab: {
                studentTotal: labStudentTotal,
                classTotal: labClassTotal,
                delta: labStudentTotal - labClassTotal,
                totalWeight: labTotalWeight,
                gradedWeight: labTotalWeight
            },
            courseStructure
        };
    },

    injectCategoryMetrics(category) {
        if (!category.row) return;
        
        if (category.row.querySelector('.qh-category-metrics')) {
            return;
        }

        const cell = category.row.querySelector('td:first-child');
        if (!cell) return;

        const metricsDiv = QalamHelper.createElement('div', 'qh-category-metrics uk-margin-small-top');
        
        if (category.hasData) {
            const deltaClass = category.delta >= 0 ? 'uk-text-success' : 'uk-text-danger';
            const deltaSymbol = category.delta >= 0 ? '+' : '';
            
            metricsDiv.innerHTML = `
                <span class="uk-text-small uk-text-muted">Class Avg: <strong>${QalamHelper.formatPercent(category.classAverage)}%</strong></span>
                <span class="uk-text-small ${deltaClass} uk-margin-small-left">
                    You vs Class: <strong>${deltaSymbol}${QalamHelper.formatPercent(category.delta)}%</strong>
                </span>
            `;
        } else {
            metricsDiv.innerHTML = '<span class="uk-badge uk-badge-warning">Not Uploaded Yet</span>';
        }
        
        cell.appendChild(metricsDiv);
    },

    injectTotalsSummary(categories, totals) {
        const table = document.querySelector('.uk-table.table_tree');
        if (!table) return;
        
        const existingSummary = document.querySelector('.qh-totals-summary');
        if (existingSummary) {
            existingSummary.remove();
        }

        const summaryRow = QalamHelper.createElement('tr', 'qh-totals-summary');
        summaryRow.style.position = 'relative';
        summaryRow.style.zIndex = '1000';
        
        const overallDeltaClass = totals.overall.delta >= 0 ? 'uk-text-success' : 'uk-text-danger';
        const overallDeltaSymbol = totals.overall.delta >= 0 ? '+' : '';
        
        const lectureDeltaClass = totals.lecture.delta >= 0 ? 'uk-text-success' : 'uk-text-danger';
        const lectureDeltaSymbol = totals.lecture.delta >= 0 ? '+' : '';
        
        const labDeltaClass = totals.lab.delta >= 0 ? 'uk-text-success' : 'uk-text-danger';
        const labDeltaSymbol = totals.lab.delta >= 0 ? '+' : '';
        
        const yourPosition = Math.min(totals.overall.studentTotal, 100);
        const classPosition = Math.min(totals.overall.classTotal, 100);
        
        let summaryHTML = `
            <td colspan="2">
                <div style="padding: 30px 20px; font-family: -apple-system, BlinkMacSystemFont, Inter, Roboto, Segoe UI, sans-serif; background: #fafbfc; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);">
                    
                    <div style="margin-bottom: 32px;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
                            <div>
                                <div style="font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #666; margin-bottom: 4px;">
                                    Overall Absolutes
                                </div>
                                <div style="font-size: 32px; font-weight: 700; color: #1e293b; line-height: 1; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                                    ${QalamHelper.formatPercent(totals.overall.studentTotal)}%
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Class Average</div>
                                <div style="font-size: 32px; font-weight: 700; color: #64748b; line-height: 1; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                                    ${QalamHelper.formatPercent(totals.overall.classTotal)}%
                                </div>
                            </div>
                        </div>
                        
                        <div style="position: relative; height: 18px; background: #cbd5e1; border-radius: 10px; overflow: visible;">
                            <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${yourPosition}%; background: linear-gradient(90deg, #1e87f0 0%, #0d6efd 100%); border-radius: 10px; transition: width 0.3s ease;"></div>
                            <div style="position: absolute; left: ${classPosition}%; top: -4px; transform: translateX(-50%); width: 3px; height: calc(100% + 8px); background: #475569; border-radius: 2px;"></div>
                        </div>
                        
                        <div style="text-align: center; margin-top: 10px; font-size: 11px; color: #999; letter-spacing: 0.5px;">
                            <span class="${overallDeltaClass}" style="font-weight: 600;">${overallDeltaSymbol}${QalamHelper.formatPercent(totals.overall.delta)}% vs class</span>
                        </div>
                    </div>
                    
                    ${totals.courseStructure.hasLab ? `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px;">
                        <div style="background: #ffffff; border-radius: 12px; border-top: 4px solid #3b82f6; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
                            <div style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #3b82f6;">Lecture</div>
                                    <div style="font-size: 13px; font-weight: 500; color: #64748b; margin-top: 2px;">${QalamHelper.formatPercent(totals.courseStructure.lectureWeight, 1)}% of overall</div>
                                </div>
                                <div style="padding: 6px 14px; background: ${totals.lecture.delta >= 0 ? '#ecfdf5' : '#fef2f2'}; border-radius: 9999px;">
                                    <span style="font-size: 13px; font-weight: 600;" class="${lectureDeltaClass}">${totals.lecture.delta >= 0 ? '↑' : '↓'} ${lectureDeltaSymbol}${QalamHelper.formatPercent(totals.lecture.delta)}</span>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px;">
                                <div>
                                    <div style="font-size: 10px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px;">Your Score</div>
                                    <div style="font-size: 36px; font-weight: 700; color: #1e293b; line-height: 1; margin-bottom: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${QalamHelper.formatPercent(totals.lecture.studentTotal)}</div>
                                    <div style="font-size: 11px; color: #64748b;">${totals.lecture.gradedWeight}% graded</div>
                                </div>
                                <div>
                                    <div style="font-size: 10px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px;">Class Average</div>
                                    <div style="font-size: 36px; font-weight: 700; color: #64748b; line-height: 1; margin-bottom: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${QalamHelper.formatPercent(totals.lecture.classTotal)}</div>
                                    <div style="font-size: 11px; color: transparent;">-</div>
                                </div>
                            </div>
                        </div>
                        <div style="background: #ffffff; border-radius: 12px; border-top: 4px solid #8b5cf6; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
                            <div style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #8b5cf6;">Lab</div>
                                    <div style="font-size: 13px; font-weight: 500; color: #64748b; margin-top: 2px;">${QalamHelper.formatPercent(totals.courseStructure.labWeight, 1)}% of overall</div>
                                </div>
                                <div style="padding: 6px 14px; background: ${totals.lab.delta >= 0 ? '#ecfdf5' : '#fef2f2'}; border-radius: 9999px;">
                                    <span style="font-size: 13px; font-weight: 600;" class="${labDeltaClass}">${totals.lab.delta >= 0 ? '↑' : '↓'} ${labDeltaSymbol}${QalamHelper.formatPercent(totals.lab.delta)}</span>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px;">
                                <div>
                                    <div style="font-size: 10px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px;">Your Score</div>
                                    <div style="font-size: 36px; font-weight: 700; color: #1e293b; line-height: 1; margin-bottom: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${QalamHelper.formatPercent(totals.lab.studentTotal)}</div>
                                    <div style="font-size: 11px; color: #64748b;">${totals.lab.gradedWeight}% graded</div>
                                </div>
                                <div>
                                    <div style="font-size: 10px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px;">Class Average</div>
                                    <div style="font-size: 36px; font-weight: 700; color: #64748b; line-height: 1; margin-bottom: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${QalamHelper.formatPercent(totals.lab.classTotal)}</div>
                                    <div style="font-size: 11px; color: transparent;">-</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div style="text-align: center; margin-top: 16px; padding: 12px; background: #f1f5f9; border-radius: 8px;">
                        <span style="font-size: 12px; color: #64748b; font-weight: 500;">${totals.lecture.gradedWeight}% of course graded so far</span>
                    </div>
                    `}
                    
                </div>
            </td>
        `;
        
        summaryRow.innerHTML = summaryHTML;
        
        const existingWrapper = table.parentElement.querySelector('.qh-summary-wrapper');
        if (existingWrapper) {
            existingWrapper.remove();
        }
        
        const wrapper = QalamHelper.createElement('div', 'qh-summary-wrapper');
        wrapper.style.marginTop = '20px';
        const innerTable = QalamHelper.createElement('table', 'uk-table');
        innerTable.appendChild(summaryRow);
        wrapper.appendChild(innerTable);
        table.parentElement.appendChild(wrapper);
    },

    init() {
        if (QalamHelper.detectPage() !== 'gradebook') return;
        
        setTimeout(() => {
            const courseStructure = this.detectCourseStructure();
            const categories = this.extractAllCategoryData();
            const totals = this.calculateTotals(categories, courseStructure);
            
            categories.forEach(cat => {
                if (cat.row) {
                    this.injectCategoryMetrics(cat);
                }
            });
            
            this.injectTotalsSummary(categories, totals);
            
            const table = document.querySelector('.uk-table.table_tree');
            if (table) {
                const observer = new MutationObserver(() => {
                    if (!document.querySelector('.qh-totals-summary')) {
                        this.injectTotalsSummary(categories, totals);
                    }
                    
                    categories.forEach(cat => {
                        if (cat.row && !cat.row.querySelector('.qh-category-metrics')) {
                            this.injectCategoryMetrics(cat);
                        }
                    });
                });
                
                observer.observe(table, {
                    childList: true,
                    subtree: true
                });
            }
            
            const tabs = document.querySelectorAll('.uk-tab li:not(.uk-tab-responsive)');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    setTimeout(() => {
                        const allVisibleRows = document.querySelectorAll('.table-parent-row');
                        
                        allVisibleRows.forEach(row => {
                            const categoryCell = row.querySelector('td');
                            if (!categoryCell) return;
                            
                            const categoryLink = categoryCell.querySelector('a');
                            let visibleName = '';
                            
                            if (categoryLink) {
                                const linkClone = categoryLink.cloneNode(true);
                                const badge = linkClone.querySelector('.uk-badge');
                                if (badge) badge.remove();
                                visibleName = linkClone.textContent.trim();
                            } else {
                                visibleName = categoryCell.textContent.trim();
                            }
                            
                            const cat = categories.find(c => c.name === visibleName);
                            
                            if (cat) {
                                cat.row = row;
                                this.injectCategoryMetrics(cat);
                            }
                        });
                        
                        this.injectTotalsSummary(categories, totals);
                    }, 400);
                });
            });
        }, 1500);
    }
};
