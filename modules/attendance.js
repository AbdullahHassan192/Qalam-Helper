//AttendanceModule - handles attendance data extraction and display

const AttendanceModule = {
    extractAttendanceData() {
        let totalClasses = 0;
        let attendedClasses = 0;

        // Look for the summary blocks with attendance data
        const summaryItems = document.querySelectorAll('.md-card-list li');
        
        summaryItems.forEach(item => {
            const text = item.textContent;
            
            if (text.includes('Number of classes Conducted')) {
                const span = item.querySelector('span');
                if (span) {
                    totalClasses += QalamHelper.parseNumber(span.textContent);
                }
            }
            
            if (text.includes('Number of classes Attended')) {
                const span = item.querySelector('span');
                if (span) {
                    attendedClasses += QalamHelper.parseNumber(span.textContent);
                }
            }
        });

        const absentClasses = totalClasses - attendedClasses;
        const attendancePercent = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;
        const requiredPercent = 75;
        const minRequired = Math.ceil(totalClasses * 0.75);
        const maxAbsences = totalClasses - minRequired;
        const remainingAbsences = maxAbsences - absentClasses;
        const status = attendancePercent >= requiredPercent ? 'safe' : 
                      attendancePercent >= 70 ? 'warning' : 'danger';

        return {
            totalClasses,
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
                        ${data.attendedClasses}/${data.totalClasses}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
                        ${data.absentClasses} absences
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
                        out of ${data.maxAbsences + 1} allowed
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

    injectDashboardAttendance() {
        // Find all course cards on dashboard
        const courseCards = document.querySelectorAll('.card');
        
        courseCards.forEach(card => {
            if (card.querySelector('.qh-attendance-widget')) return;

            const cardBody = card.querySelector('.card-body');
            if (!cardBody) return;

            // Find the .uk-text-small div that contains "Attendance:"
            const textDivs = cardBody.querySelectorAll('.uk-text-small');
            let attendanceDiv = null;
            
            textDivs.forEach(div => {
                if (div.textContent.includes('Attendance:')) {
                    attendanceDiv = div;
                }
            });

            if (!attendanceDiv) {
                return;
            }

            const span = attendanceDiv.querySelector('span');
            if (!span) {
                return;
            }

            const attendancePercent = QalamHelper.parseNumber(span.textContent);
            
            // We need to fetch the actual total classes to calculate remaining absences
            // For now, estimate based on typical semester (48 classes for 2+1, 32 for 2+0)
            // This will be updated when we have access to the detailed attendance page
            const estimatedTotal = 48; // Conservative estimate
            const minRequired = Math.ceil(estimatedTotal * 0.75);
            const maxAbsences = estimatedTotal - minRequired;
            const currentAbsences = Math.round((estimatedTotal * (100 - attendancePercent)) / 100);
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
                    <div style="padding: 4px 12px; background: ${statusBg}; border-radius: 6px;">
                        <span style="font-size: 10px; font-weight: 600; color: ${statusColor};">
                            ${remainingAbsences > 2 ? '✓ Safe' : remainingAbsences > 0 ? '⚠ Low' : '⚠ None'}
                        </span>
                    </div>
                </div>
            `;

            cardBody.appendChild(widget);
        });
    },

    injectAttendanceOverview() {
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
        courseCards.forEach(card => {
            // Skip if already has widget
            const cardContent = card.querySelector('.md-card-content');
            if (cardContent && cardContent.querySelector('.qh-attendance-widget')) {
                return;
            }

            if (!cardContent) {
                return;
            }

            // Must have a link to attendance detail page (to confirm it's a course card)
            const attendanceLink = card.querySelector('a[href*="/student/course/attendance/"]');
            if (!attendanceLink) {
                return;
            }

            // Get course name for debugging
            const courseName = card.querySelector('.md-list-heading');
            const courseNameText = courseName ? courseName.textContent.trim() : 'Unknown';

            const attendanceText = cardContent.querySelector('.uk-text-small');
            if (!attendanceText || !attendanceText.textContent.includes('Attendance:')) {
                return;
            }

            const attendancePercent = QalamHelper.parseNumber(attendanceText.textContent);
            
            // Estimate total classes (conservative)
            const estimatedTotal = 48;
            const minRequired = Math.ceil(estimatedTotal * 0.75);
            const maxAbsences = estimatedTotal - minRequired;
            const currentAbsences = Math.round((estimatedTotal * (100 - attendancePercent)) / 100);
            const remainingAbsences = Math.max(0, maxAbsences - currentAbsences);
            
            const statusColor = remainingAbsences > 2 ? '#10b981' : 
                               remainingAbsences > 0 ? '#f59e0b' : '#ef4444';

            const widget = QalamHelper.createElement('div', 'qh-attendance-widget');
            widget.style.cssText = 'margin-top: 8px; font-size: 13px; font-weight: 600; color: ' + statusColor + ';';
            widget.textContent = `Remaining: ${remainingAbsences} absences`;

            cardContent.appendChild(widget);
            processed++;
        });
    },

    init() {
        const page = QalamHelper.detectPage();

        
        if (page === 'attendance-detail') {
            setTimeout(() => {
                const data = this.extractAttendanceData();
                if (data) {
                    this.injectAttendanceSummary(data);
                }
            }, 1000);
        }

        if (page === 'attendance-overview') {
            // Continuously check and re-inject every 500ms
            setInterval(() => {
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
            setTimeout(() => this.injectDashboardAttendance(), 1500);
        }
    }
};
