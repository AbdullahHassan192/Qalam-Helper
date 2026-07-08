//AttendanceModule - handles attendance data extraction and display

const AttendanceModule = {
    // Flag to prevent concurrent executions of overview injection
    isProcessingOverview: false,

    markTabContainers() {
        const cardContents = document.querySelectorAll('.md-card-content');
        cardContents.forEach(content => {
            if (content.querySelector('.uk-tab')) {
                content.classList.add('qh-has-tabs');
            } else {
                content.classList.remove('qh-has-tabs');
            }
        });
    },

    extractAttendanceData(courseId = null) {
        let attendedClasses = 0;
        let conductedClasses = 0;

        // Look for the summary blocks with attendance data
        const summaryItems = document.querySelectorAll('.md-card-list li');
        
        summaryItems.forEach(item => {
            const text = item.textContent;
            
            if (text.includes('Number of classes Conducted')) {
                const span = item.querySelector('span');
                if (span) {
                    conductedClasses += QalamHelper.parseNumber(span.textContent);
                }
            }
            
            if (text.includes('Number of classes Attended')) {
                const span = item.querySelector('span');
                if (span) {
                    attendedClasses += QalamHelper.parseNumber(span.textContent);
                }
            }
        });

        // Get credit hours from cache if courseId provided
        let creditHours = 3; // Default fallback
        if (courseId && ResultsModule && ResultsModule.creditHoursCache) {
            creditHours = ResultsModule.creditHoursCache[courseId] || 3;
        }

        // Calculate total classes for semester: Credits * 16 weeks
        const totalClasses = creditHours * 16;
        const requiredPresent = Math.ceil(totalClasses * 0.75);
        const maxAbsences = totalClasses - requiredPresent;
        
        // Use conducted classes if available (early semester), otherwise use calculated total
        const effectiveTotalClasses = conductedClasses > 0 ? conductedClasses : totalClasses;
        const absentClasses = effectiveTotalClasses - attendedClasses;
        const attendancePercent = effectiveTotalClasses > 0 ? (attendedClasses / effectiveTotalClasses) * 100 : 0;
        const remainingAbsences = maxAbsences - absentClasses;
        const requiredPercent = 75;
        const status = attendancePercent >= requiredPercent ? 'safe' : 
                      attendancePercent >= 70 ? 'warning' : 'danger';

        return {
            totalClasses,
            conductedClasses,
            attendedClasses,
            absentClasses,
            attendancePercent,
            requiredPercent,
            maxAbsences,
            remainingAbsences,
            status
        };
    },

    injectAttendanceSummary(data) {
        const tabs = document.querySelector('#tabs_anim1');
        if (!tabs) return;

        const existing = document.querySelector('.qh-attendance-summary');
        if (existing) existing.remove();

        const statusColor = data.status === 'safe' ? '#10b981' : 
                           data.status === 'warning' ? '#f59e0b' : '#ef4444';
        const statusBg = data.status === 'safe' ? '#ecfdf5' : 
                        data.status === 'warning' ? '#fffbeb' : '#fef2f2';
        const statusText = data.status === 'safe' ? 'Safe' : 
                          data.status === 'warning' ? 'Warning' : 'At Risk';

        const summaryDiv = QalamHelper.createElement('div', 'qh-attendance-summary');
        summaryDiv.style.cssText = 'margin: 20px 0; padding: 24px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-left: 4px solid ' + statusColor + ';';

        summaryDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px;">
                <div>
                    <div style="font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
                        Attendance Rate
                    </div>
                    <div style="font-size: 36px; font-weight: 700; color: ${statusColor}; line-height: 1; font-family: ui-monospace, monospace;">
                        ${QalamHelper.formatPercent(data.attendancePercent, 1)}%
                    </div>
                    <div style="margin-top: 8px; padding: 4px 12px; background: ${statusBg}; border-radius: 6px; display: inline-block;">
                        <span style="font-size: 12px; font-weight: 600; color: ${statusColor};">${statusText}</span>
                    </div>
                </div>

                <div>
                    <div style="font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
                        Classes Attended
                    </div>
                    <div style="font-size: 36px; font-weight: 700; color: #1e293b; line-height: 1; font-family: ui-monospace, monospace;">
                        ${data.attendedClasses}/${data.conductedClasses > 0 ? data.conductedClasses : data.totalClasses}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
                        ${data.absentClasses} absences • ${data.totalClasses} total classes expected
                    </div>
                </div>

                <div>
                    <div style="font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
                        Remaining Absences
                    </div>
                    <div style="font-size: 36px; font-weight: 700; color: ${data.remainingAbsences > 2 ? '#10b981' : data.remainingAbsences > 0 ? '#f59e0b' : '#ef4444'}; line-height: 1; font-family: ui-monospace, monospace;">
                        ${Math.max(0, data.remainingAbsences)}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
                        out of ${data.maxAbsences} allowed
                    </div>
                </div>

                <div>
                    <div style="font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
                        Required Minimum
                    </div>
                    <div style="font-size: 36px; font-weight: 700; color: #64748b; line-height: 1; font-family: ui-monospace, monospace;">
                        ${data.requiredPercent}%
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
                        ${data.attendancePercent >= data.requiredPercent ? '✓ Meeting requirement' : '⚠ Below minimum'}
                    </div>
                </div>
            </div>
        `;

        tabs.parentNode.insertBefore(summaryDiv, tabs);
    },

    async fetchAttendanceData(courseId) {
        try {
            const response = await fetch(`https://qalam.nust.edu.pk/student/course/attendance/${courseId}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Check if course has Lab component
            const tabs = doc.querySelectorAll('.uk-tab li');
            let hasLab = false;
            tabs.forEach(tab => {
                const text = tab.textContent.trim().toLowerCase();
                if (text.includes('lab')) {
                    hasLab = true;
                }
            });

            let lectureAttended = 0;
            let lectureConducted = 0;
            let labAttended = 0;
            let labConducted = 0;

            // Get all tab content containers
            const tabContainers = doc.querySelectorAll('#tabs_anim1 > li');
            
            if (tabContainers.length > 1 && hasLab) {
                // Multiple tabs (Lecture and Lab)
                tabContainers.forEach((container, index) => {
                    const isLab = index === 1; // Second tab is Lab
                    
                    const summaryItems = container.querySelectorAll('.md-card-list li');
                    summaryItems.forEach(item => {
                        const text = item.textContent;
                        const span = item.querySelector('span');
                        if (!span) return;
                        
                        if (text.includes('Number of classes Conducted')) {
                            const value = parseInt(span.textContent.trim()) || 0;
                            if (isLab) {
                                labConducted = value;
                            } else {
                                lectureConducted = value;
                            }
                        }
                        
                        if (text.includes('Number of classes Attended')) {
                            const value = parseInt(span.textContent.trim()) || 0;
                            if (isLab) {
                                labAttended = value;
                            } else {
                                lectureAttended = value;
                            }
                        }
                    });
                });
            } else {
                // Single tab (Lecture only)
                const summaryItems = doc.querySelectorAll('.md-card-list li');
                summaryItems.forEach(item => {
                    const text = item.textContent;
                    const span = item.querySelector('span');
                    if (!span) return;
                    
                    if (text.includes('Number of classes Conducted')) {
                        lectureConducted = parseInt(span.textContent.trim()) || 0;
                    }
                    
                    if (text.includes('Number of classes Attended')) {
                        lectureAttended = parseInt(span.textContent.trim()) || 0;
                    }
                });
            }

            // Return combined totals
            return {
                attendedClasses: lectureAttended + labAttended,
                conductedClasses: lectureConducted + labConducted
            };
        } catch (error) {
            console.error('Failed to fetch attendance data:', error);
            return null;
        }
    },

    async injectDashboardAttendance() {
        // Find all course cards on dashboard
        const courseCards = document.querySelectorAll('.card');
        
        for (const card of courseCards) {
            if (card.querySelector('.qh-attendance-widget')) continue;

            const cardBody = card.querySelector('.card-body');
            if (!cardBody) continue;

            // Find the .uk-text-small div that contains "Attendance:"
            const textDivs = cardBody.querySelectorAll('.uk-text-small');
            let attendanceDiv = null;
            
            textDivs.forEach(div => {
                if (div.textContent.includes('Attendance:')) {
                    attendanceDiv = div;
                }
            });

            if (!attendanceDiv) {
                continue;
            }

            // Color the attendance text based on percentage
            const attendanceSpan = attendanceDiv.querySelector('span');
            if (attendanceSpan) {
                const attendancePercent = parseFloat(attendanceSpan.textContent) || 0;
                let color;
                if (attendancePercent >= 80) {
                    color = '#10b981'; // Green
                } else if (attendancePercent >= 75) {
                    color = '#f59e0b'; // Yellow/Orange
                } else {
                    color = '#ef4444'; // Red
                }
                attendanceDiv.style.color = color;
                attendanceDiv.style.fontWeight = '600';
            }

            // Get course ID from parent link
            const parentLink = card.parentElement;
            let courseId = null;
            if (parentLink && parentLink.href) {
                const courseIdMatch = parentLink.href.match(/\/course\/info\/(\d+)/);
                if (courseIdMatch) {
                    courseId = courseIdMatch[1];
                }
            }
            
            if (!courseId) {
                continue;
            }
            
            // Fetch actual attendance data
            const attendanceData = await this.fetchAttendanceData(courseId);
            if (!attendanceData) {
                continue;
            }
            
            // Get credit hours from cache
            let creditHours = 3; // Default fallback
            if (ResultsModule && ResultsModule.creditHoursCache) {
                creditHours = ResultsModule.creditHoursCache[courseId] || 3;
            }
            
            // Calculate using credit hour formula
            const totalClasses = creditHours * 16;
            const requiredPresent = Math.ceil(totalClasses * 0.75);
            const maxAbsences = totalClasses - requiredPresent;
            const attendedClasses = attendanceData.attendedClasses;
            const currentAbsences = attendanceData.conductedClasses - attendedClasses;
            const remainingAbsences = Math.max(0, maxAbsences - currentAbsences);
            
            const statusColor = remainingAbsences > 2 ? '#10b981' : 
                               remainingAbsences > 0 ? '#f59e0b' : '#ef4444';
            const statusBg = remainingAbsences > 2 ? '#ecfdf5' : 
                            remainingAbsences > 0 ? '#fffbeb' : '#fef2f2';

            const widget = QalamHelper.createElement('div', 'qh-attendance-widget');
            widget.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;';

            widget.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div style="flex: 1;">
                        <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">Remaining Absences</div>
                        <div style="font-size: 18px; font-weight: 700; color: ${statusColor}; font-family: ui-monospace, monospace;">${remainingAbsences}</div>
                    </div>
                    <div style="text-align: right; flex: 1;">
                        <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">Attended</div>
                        <div style="font-size: 14px; font-weight: 700; color: #1e293b; font-family: ui-monospace, monospace;">${attendedClasses}/${attendanceData.conductedClasses}</div>
                    </div>
                </div>
            `;

            cardBody.appendChild(widget);
        }
    },

    async injectAttendanceOverview() {
        // Prevent concurrent executions
        if (this.isProcessingOverview) {
            return;
        }
        
        this.isProcessingOverview = true;

        this.markTabContainers();
        
        // Find and remove any orphaned widgets
        const allWidgets = document.querySelectorAll('.qh-attendance-widget');
        allWidgets.forEach(widget => {
            const parentCard = widget.closest('.md-card');
            if (!parentCard) {
                widget.remove();
            }
        });
        
        // Find all course cards on attendance overview page
        // Only select cards that have both a gradebook link AND attendance info
        const courseCards = document.querySelectorAll('.md-card');
        
        let processed = 0;
        for (const card of courseCards) {
            // Skip if already has widget
            const cardContent = card.querySelector('.md-card-content');
            if (cardContent && cardContent.querySelector('.qh-attendance-widget')) {
                continue;
            }

            if (!cardContent) {
                continue;
            }

            // Must have a link to attendance detail page (to confirm it's a course card)
            const attendanceLink = card.querySelector('a[href*="/student/course/attendance/"]');
            if (!attendanceLink) {
                continue;
            }

            // Get course ID from attendance link
            let courseId = null;
            const courseIdMatch = attendanceLink.href.match(/\/attendance\/(\d+)/);
            if (courseIdMatch) {
                courseId = courseIdMatch[1];
            }
            
            if (!courseId) {
                continue;
            }
            
            // Fetch actual attendance data
            const attendanceData = await this.fetchAttendanceData(courseId);
            if (!attendanceData) {
                continue;
            }
            
            // Get credit hours from cache
            let creditHours = 3; // Default fallback
            if (ResultsModule && ResultsModule.creditHoursCache) {
                creditHours = ResultsModule.creditHoursCache[courseId] || 3;
            }
            
            // Calculate using credit hour formula
            const totalClasses = creditHours * 16;
            const requiredPresent = Math.ceil(totalClasses * 0.75);
            const maxAbsences = totalClasses - requiredPresent;
            const attendedClasses = attendanceData.attendedClasses;
            const currentAbsences = attendanceData.conductedClasses - attendedClasses;
            const remainingAbsences = Math.max(0, maxAbsences - currentAbsences);
            
            const statusColor = remainingAbsences > 2 ? '#10b981' : 
                               remainingAbsences > 0 ? '#f59e0b' : '#ef4444';

            const widget = QalamHelper.createElement('div', 'qh-attendance-widget');
            widget.style.cssText = 'margin-top: 8px; font-size: 13px; font-weight: 600; color: ' + statusColor + ';';
            widget.textContent = `Remaining: ${remainingAbsences} absences`;

            cardContent.appendChild(widget);
            processed++;
        }
        
        // Release the lock
        this.isProcessingOverview = false;
    },

    init() {
        const page = QalamHelper.detectPage();

        
        if (page === 'attendance-detail') {
            setTimeout(() => {
                // Extract courseId from URL
                let courseId = null;
                const urlMatch = window.location.href.match(/\/attendance\/(\d+)/);
                if (urlMatch) {
                    courseId = urlMatch[1];
                }
                
                const data = this.extractAttendanceData(courseId);
                if (data) {
                    this.injectAttendanceSummary(data);
                }
            }, 1000);
        }

        if (page === 'attendance-overview') {
            // Continuously check and re-inject every 500ms
            setInterval(() => {
                this.markTabContainers();

                // First remove any orphaned widgets
                const allWidgets = document.querySelectorAll('.qh-attendance-widget');
                allWidgets.forEach(widget => {
                    const parentCard = widget.closest('.md-card');
                    if (!parentCard) {
                        widget.remove();
                    }
                });
                
                // Then check if any cards need widgets
                const cards = document.querySelectorAll('.md-card');
                let needsReinject = false;
                
                cards.forEach(card => {
                    const content = card.querySelector('.md-card-content');
                    const attendanceText = content?.querySelector('.uk-text-small');
                    const hasWidget = content?.querySelector('.qh-attendance-widget');
                    const hasAttendanceData = attendanceText && attendanceText.textContent.includes('Attendance:');
                    
                    if (hasAttendanceData && !hasWidget) {
                        needsReinject = true;
                    }
                });
                
                if (needsReinject) {
                    this.injectAttendanceOverview();
                }
            }, 500);
        }

        if (page === 'dashboard') {
            setTimeout(async () => await this.injectDashboardAttendance(), 1500);
        }
    }
};
