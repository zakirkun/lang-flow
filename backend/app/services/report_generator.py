import os
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional, List

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    # Mock classes for when reportlab is not available
    class MockParagraphStyle:
        def __init__(self, **kwargs):
            pass
    class MockStyles:
        def add(self, style):
            pass
        def __getitem__(self, key):
            return MockParagraphStyle()

try:
    from langchain_openai import ChatOpenAI
    from langchain.schema import HumanMessage
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False

from ..models import RunResult

try:
    from .ai import get_openai_client
except ImportError:
    def get_openai_client(*args, **kwargs):
        raise RuntimeError("OpenAI client not available. Please install required dependencies.")


class ReportGenerator:
    """Service for generating formal PDF reports from workflow run data"""
    
    def __init__(self):
        if REPORTLAB_AVAILABLE:
            self.styles = getSampleStyleSheet()
            self._setup_custom_styles()
        else:
            self.styles = MockStyles()
    
    def _serialize_for_json(self, obj):
        """Recursively serialize objects to JSON-safe format"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {key: self._serialize_for_json(value) for key, value in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [self._serialize_for_json(item) for item in obj]
        else:
            return obj
    
    def _markdown_to_reportlab(self, text: str) -> str:
        """Convert basic markdown formatting to ReportLab-compatible HTML"""
        if not text:
            return ""
        
        # Escape any existing HTML entities first
        text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        
        # Convert markdown to basic HTML that ReportLab can handle
        # Bold text: **text** or __text__ -> <b>text</b>
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        text = re.sub(r'__(.*?)__', r'<b>\1</b>', text)
        
        # Italic text: *text* or _text_ -> <i>text</i>
        text = re.sub(r'(?<!\*)\*([^*]+?)\*(?!\*)', r'<i>\1</i>', text)
        text = re.sub(r'(?<!_)_([^_]+?)_(?!_)', r'<i>\1</i>', text)
        
        # Code text: `text` -> <font name="Courier">text</font>
        text = re.sub(r'`([^`]+?)`', r'<font name="Courier" size="9">\1</font>', text)
        
        # Headers: # text -> larger bold text
        text = re.sub(r'^### (.*?)$', r'<b><font size="12">\1</font></b>', text, flags=re.MULTILINE)
        text = re.sub(r'^## (.*?)$', r'<b><font size="14">\1</font></b>', text, flags=re.MULTILINE)
        text = re.sub(r'^# (.*?)$', r'<b><font size="16">\1</font></b>', text, flags=re.MULTILINE)
        
        # Line breaks: preserve line breaks but be conservative
        text = text.replace('\n\n', '<br/><br/>')  # Paragraph breaks
        text = text.replace('\n', '<br/>')  # Line breaks
        
        # Lists: - item -> bullet points
        text = re.sub(r'^- (.*?)(?=<br/>|$)', r'• \1', text, flags=re.MULTILINE)
        
        # Links: [text](url) -> just text (ReportLab has limited link support)
        text = re.sub(r'\[([^\]]+?)\]\([^)]+?\)', r'\1', text)
        
        # Clean up any problematic characters that might break PDF generation
        text = text.replace('"', '"').replace('"', '"')  # Smart quotes
        text = text.replace(''', "'").replace(''', "'")  # Smart apostrophes
        
        return text
    
    def _create_markdown_paragraphs(self, text: str, style_name: str) -> List:
        """Convert markdown text to list of ReportLab paragraphs"""
        if not REPORTLAB_AVAILABLE:
            return []
        
        # Split text into logical sections
        sections = text.split('\n\n')
        paragraphs = []
        
        for section in sections:
            if not section.strip():
                continue
                
            # Convert markdown to ReportLab HTML
            formatted_text = self._markdown_to_reportlab(section.strip())
            
            # Create paragraph with proper style
            if formatted_text:
                paragraphs.append(Paragraph(formatted_text, self.styles[style_name]))
                paragraphs.append(Spacer(1, 6))  # Small spacing between paragraphs
        
        return paragraphs
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles for the report"""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Title'],
            fontSize=24,
            textColor=colors.HexColor('#1a202c'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Section header style
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#2d3748'),
            spaceBefore=20,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        ))
        
        # Subsection header style
        self.styles.add(ParagraphStyle(
            name='SubsectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#4a5568'),
            spaceBefore=15,
            spaceAfter=8,
            fontName='Helvetica-Bold'
        ))
        
        # Body text style
        self.styles.add(ParagraphStyle(
            name='ReportBodyText',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#2d3748'),
            spaceAfter=6,
            alignment=TA_JUSTIFY,
            fontName='Helvetica'
        ))
        
        # Code style
        self.styles.add(ParagraphStyle(
            name='ReportCodeText',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#1a202c'),
            fontName='Courier',
            backColor=colors.HexColor('#f7fafc'),
            borderColor=colors.HexColor('#e2e8f0'),
            borderWidth=1,
            borderPadding=5
        ))
        
        # Enhanced body text style for markdown content
        self.styles.add(ParagraphStyle(
            name='ReportMarkdownText',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#2d3748'),
            spaceAfter=8,
            spaceBefore=4,
            alignment=TA_JUSTIFY,
            fontName='Helvetica',
            leftIndent=0,
            rightIndent=0,
            allowWidows=1,
            allowOrphans=1
        ))

    async def generate_formal_report(self, run_result: RunResult, output_path: str) -> str:
        """Generate a formal PDF report from run result data"""
        
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("ReportLab is not installed. Please install reportlab to generate PDF reports: pip install reportlab")
        
        # Get AI summary of the run
        summary_data = await self._generate_ai_summary(run_result)
        
        # Create PDF document
        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=1*inch,
            bottomMargin=1*inch
        )
        
        # Build story (content)
        story = []
        
        # Add title page
        story.extend(self._build_title_page(run_result, summary_data))
        story.append(PageBreak())
        
        # Add executive summary
        story.extend(self._build_executive_summary(summary_data))
        
        # Add technical details
        story.extend(self._build_technical_details(run_result))
        
        # Add step analysis
        story.extend(self._build_step_analysis(run_result, summary_data))
        
        # Add recommendations
        story.extend(self._build_recommendations(summary_data))
        
        # Add appendix
        story.extend(self._build_appendix(run_result))
        
        # Build PDF
        doc.build(story)
        
        return output_path
    
    async def _generate_ai_summary(self, run_result: RunResult) -> Dict[str, Any]:
        """Generate AI summary using ChatGPT"""
        
        # Prepare data for AI analysis
        analysis_data = {
            "workflow_id": run_result.workflow_id,
            "run_id": run_result.run_id,
            "status": run_result.status,
            "started_at": run_result.started_at.isoformat() if run_result.started_at else None,
            "finished_at": run_result.finished_at.isoformat() if run_result.finished_at else None,
            "total_steps": len(run_result.logs),
            "successful_steps": len([log for log in run_result.logs if log.status == "success"]),
            "failed_steps": len([log for log in run_result.logs if log.status == "error"]),
            "context": self._serialize_for_json(run_result.context),
            "steps": []
        }
        
        # Add step details
        for log in run_result.logs:
            step_data = {
                "name": log.step_name,
                "type": log.step_type,
                "status": log.status,
                "started_at": log.started_at.isoformat() if log.started_at else None,
                "finished_at": log.finished_at.isoformat() if log.finished_at else None,
                "output": log.output[:500] if log.output else None,  # Limit output length
                "error": log.error if log.error else None
            }
            # Ensure all data is JSON serializable
            step_data = self._serialize_for_json(step_data)
            analysis_data["steps"].append(step_data)
        
        # Create prompt for ChatGPT
        prompt = f"""
        You are a cybersecurity expert tasked with creating a formal executive summary for a penetration testing workflow execution report.
        
        Analyze the following workflow execution data and provide a comprehensive summary in formal English:
        
        {json.dumps(self._serialize_for_json(analysis_data), indent=2, default=str)}
        
        Please provide your analysis in the following JSON format:
        {{
            "executive_summary": "A comprehensive 2-3 paragraph executive summary of the workflow execution, highlighting key findings and overall assessment",
            "key_findings": [
                "Finding 1: Brief description of important discovery",
                "Finding 2: Another significant finding",
                "Finding 3: Additional important observation"
            ],
            "security_assessment": "Overall security posture assessment based on the execution results",
            "risk_level": "HIGH/MEDIUM/LOW based on findings",
            "recommendations": [
                "Recommendation 1: Specific actionable recommendation",
                "Recommendation 2: Another important recommendation",
                "Recommendation 3: Additional security recommendation"
            ],
            "technical_summary": "Technical summary of what was executed and discovered",
            "conclusion": "Overall conclusion and next steps"
        }}
        
        Ensure all text is professional, formal, and suitable for executive reporting.
        """
        
        try:
            if not LANGCHAIN_AVAILABLE:
                raise Exception("LangChain not available")
                
            # Get OpenAI client
            client = get_openai_client("gpt-4o", api_key=os.getenv("OPENAI_API_KEY"))
            
            # Generate summary
            response = client.invoke([HumanMessage(content=prompt)])
            
            # Parse JSON response
            summary_text = response.content
            
            # Extract JSON from response (handle potential markdown formatting)
            if "```json" in summary_text:
                summary_text = summary_text.split("```json")[1].split("```")[0]
            elif "```" in summary_text:
                summary_text = summary_text.split("```")[1].split("```")[0]
            
            summary_data = json.loads(summary_text)
            
            return summary_data
            
        except Exception as e:
            # Fallback summary if AI fails
            return {
                "executive_summary": f"This report presents the results of a penetration testing workflow execution (Run ID: {run_result.run_id}). The workflow completed with status: {run_result.status}. Out of {len(run_result.logs)} total steps, {len([log for log in run_result.logs if log.status == 'success'])} completed successfully.",
                "key_findings": [
                    f"Workflow execution status: {run_result.status}",
                    f"Total steps executed: {len(run_result.logs)}",
                    f"Success rate: {len([log for log in run_result.logs if log.status == 'success'])}/{len(run_result.logs)}"
                ],
                "security_assessment": "Assessment requires manual review due to AI processing limitation.",
                "risk_level": "UNKNOWN",
                "recommendations": [
                    "Review individual step outputs for security findings",
                    "Analyze any failed steps for potential issues",
                    "Consider re-running workflow if failures occurred"
                ],
                "technical_summary": f"Automated penetration testing workflow executed {len(run_result.logs)} steps including AI analysis, command execution, and reporting phases.",
                "conclusion": "Manual review of results is recommended for comprehensive assessment."
            }
    
    def _build_title_page(self, run_result: RunResult, summary_data: Dict[str, Any]) -> list:
        """Build title page content"""
        story = []
        
        # Title
        story.append(Paragraph("PENETRATION TESTING REPORT", self.styles['CustomTitle']))
        story.append(Spacer(1, 0.5*inch))
        
        # Subtitle
        story.append(Paragraph(f"Workflow Execution Analysis", self.styles['SectionHeader']))
        story.append(Spacer(1, 0.3*inch))
        
        # Report info table
        report_data = [
            ['Report Generated:', datetime.now().strftime("%B %d, %Y at %H:%M UTC")],
            ['Run ID:', run_result.run_id],
            ['Workflow ID:', run_result.workflow_id],
            ['Execution Status:', run_result.status.upper()],
            ['Start Time:', run_result.started_at.strftime("%B %d, %Y at %H:%M UTC") if run_result.started_at else 'N/A'],
            ['End Time:', run_result.finished_at.strftime("%B %d, %Y at %H:%M UTC") if run_result.finished_at else 'In Progress'],
            ['Risk Level:', summary_data.get('risk_level', 'UNKNOWN')]
        ]
        
        table = Table(report_data, colWidths=[2*inch, 4*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f7fafc')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2d3748')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        story.append(table)
        story.append(Spacer(1, 1*inch))
        
        # Disclaimer
        disclaimer = """
        This report contains the results of an automated penetration testing workflow execution. 
        The findings and recommendations contained herein are based on the specific tests performed 
        and should be considered as part of a comprehensive security assessment program.
        """
        story.append(Paragraph(disclaimer, self.styles['ReportBodyText']))
        
        return story
    
    def _build_executive_summary(self, summary_data: Dict[str, Any]) -> list:
        """Build executive summary section"""
        story = []
        
        story.append(Paragraph("EXECUTIVE SUMMARY", self.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        # Executive summary content
        summary_text = summary_data.get('executive_summary', 'Executive summary not available.')
        # Convert markdown formatting to ReportLab HTML
        summary_paragraphs = self._create_markdown_paragraphs(summary_text, 'ReportMarkdownText')
        if summary_paragraphs:
            story.extend(summary_paragraphs)
        else:
            story.append(Paragraph(summary_text, self.styles['ReportBodyText']))
        story.append(Spacer(1, 0.2*inch))
        
        # Security assessment
        story.append(Paragraph("Security Assessment", self.styles['SubsectionHeader']))
        assessment_text = summary_data.get('security_assessment', 'Security assessment not available.')
        # Convert markdown formatting
        assessment_paragraphs = self._create_markdown_paragraphs(assessment_text, 'ReportMarkdownText')
        if assessment_paragraphs:
            story.extend(assessment_paragraphs)
        else:
            story.append(Paragraph(assessment_text, self.styles['ReportBodyText']))
        story.append(Spacer(1, 0.2*inch))
        
        # Key findings
        story.append(Paragraph("Key Findings", self.styles['SubsectionHeader']))
        findings = summary_data.get('key_findings', [])
        for i, finding in enumerate(findings, 1):
            # Process finding text for markdown
            formatted_finding = self._markdown_to_reportlab(finding) if finding else finding
            story.append(Paragraph(f"{i}. {formatted_finding}", self.styles['ReportBodyText']))
        
        story.append(Spacer(1, 0.3*inch))
        
        return story
    
    def _build_technical_details(self, run_result: RunResult) -> list:
        """Build technical details section"""
        story = []
        
        story.append(Paragraph("TECHNICAL EXECUTION DETAILS", self.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        # Execution statistics
        total_steps = len(run_result.logs)
        successful_steps = len([log for log in run_result.logs if log.status == "success"])
        failed_steps = len([log for log in run_result.logs if log.status == "error"])
        
        stats_data = [
            ['Metric', 'Value'],
            ['Total Steps Executed', str(total_steps)],
            ['Successful Steps', str(successful_steps)],
            ['Failed Steps', str(failed_steps)],
            ['Success Rate', f"{(successful_steps/total_steps*100):.1f}%" if total_steps > 0 else "0%"],
            ['Overall Status', run_result.status.upper()]
        ]
        
        table = Table(stats_data, colWidths=[3*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a5568')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ]))
        
        story.append(table)
        story.append(Spacer(1, 0.3*inch))
        
        return story
    
    def _build_step_analysis(self, run_result: RunResult, summary_data: Dict[str, Any]) -> list:
        """Build detailed step analysis section"""
        story = []
        
        story.append(Paragraph("STEP-BY-STEP ANALYSIS", self.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        # Technical summary
        tech_summary = summary_data.get('technical_summary', 'Technical analysis not available.')
        # Convert markdown formatting
        tech_paragraphs = self._create_markdown_paragraphs(tech_summary, 'ReportMarkdownText')
        if tech_paragraphs:
            story.extend(tech_paragraphs)
        else:
            story.append(Paragraph(tech_summary, self.styles['ReportBodyText']))
        story.append(Spacer(1, 0.2*inch))
        
        # Individual step details
        for i, log in enumerate(run_result.logs, 1):
            story.append(Paragraph(f"Step {i}: {log.step_name}", self.styles['SubsectionHeader']))
            
            # Step info table
            step_data = [
                ['Type:', log.step_type.upper()],
                ['Status:', log.status.upper()],
                ['Started:', log.started_at.strftime("%H:%M:%S") if log.started_at else 'N/A'],
                ['Finished:', log.finished_at.strftime("%H:%M:%S") if log.finished_at else 'N/A']
            ]
            
            step_table = Table(step_data, colWidths=[1*inch, 4*inch])
            step_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            
            story.append(step_table)
            story.append(Spacer(1, 0.1*inch))
            
            # Output (truncated for readability)
            if log.output:
                story.append(Paragraph("Output:", self.styles['SubsectionHeader']))
                output_text = log.output[:1000] + "..." if len(log.output) > 1000 else log.output
                # Process output for basic markdown (especially for AI responses)
                formatted_output = self._markdown_to_reportlab(output_text)
                story.append(Paragraph(formatted_output, self.styles['ReportCodeText']))
                story.append(Spacer(1, 0.1*inch))
            
            # Error (if any)
            if log.error:
                story.append(Paragraph("Error:", self.styles['SubsectionHeader']))
                # Process error text for markdown
                formatted_error = self._markdown_to_reportlab(log.error)
                story.append(Paragraph(formatted_error, self.styles['ReportCodeText']))
                story.append(Spacer(1, 0.1*inch))
            
            story.append(Spacer(1, 0.2*inch))
        
        return story
    
    def _build_recommendations(self, summary_data: Dict[str, Any]) -> list:
        """Build recommendations section"""
        story = []
        
        story.append(Paragraph("RECOMMENDATIONS", self.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        recommendations = summary_data.get('recommendations', [])
        if recommendations:
            for i, recommendation in enumerate(recommendations, 1):
                # Process recommendation text for markdown
                formatted_recommendation = self._markdown_to_reportlab(recommendation) if recommendation else recommendation
                story.append(Paragraph(f"{i}. {formatted_recommendation}", self.styles['ReportBodyText']))
                story.append(Spacer(1, 0.1*inch))
        else:
            story.append(Paragraph("No specific recommendations available at this time.", self.styles['ReportBodyText']))
        
        story.append(Spacer(1, 0.3*inch))
        
        # Conclusion
        story.append(Paragraph("CONCLUSION", self.styles['SectionHeader']))
        conclusion = summary_data.get('conclusion', 'Please review the detailed findings and implement recommended security measures.')
        # Convert markdown formatting for conclusion
        conclusion_paragraphs = self._create_markdown_paragraphs(conclusion, 'ReportMarkdownText')
        if conclusion_paragraphs:
            story.extend(conclusion_paragraphs)
        else:
            story.append(Paragraph(conclusion, self.styles['ReportBodyText']))
        
        return story
    
    def _build_appendix(self, run_result: RunResult) -> list:
        """Build appendix with raw data"""
        story = []
        
        story.append(PageBreak())
        story.append(Paragraph("APPENDIX: RAW EXECUTION DATA", self.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        # Context data
        if run_result.context:
            story.append(Paragraph("Execution Context:", self.styles['SubsectionHeader']))
            context_json = json.dumps(self._serialize_for_json(run_result.context), indent=2, default=str)
            story.append(Paragraph(context_json, self.styles['ReportCodeText']))
            story.append(Spacer(1, 0.2*inch))
        
        # Full step logs
        story.append(Paragraph("Complete Step Logs:", self.styles['SubsectionHeader']))
        for log in run_result.logs:
            log_data = {
                "step_id": log.step_id,
                "step_name": log.step_name,
                "step_type": log.step_type,
                "status": log.status,
                "started_at": log.started_at,
                "finished_at": log.finished_at,
                "output": log.output,
                "error": log.error
            }
            # Serialize safely for JSON
            serialized_log_data = self._serialize_for_json(log_data)
            log_json = json.dumps(serialized_log_data, indent=2, default=str)
            story.append(Paragraph(log_json, self.styles['ReportCodeText']))
            story.append(Spacer(1, 0.1*inch))
        
        return story


# Global instance
report_generator = ReportGenerator()
