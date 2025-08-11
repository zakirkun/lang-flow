import asyncio
import smtplib
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
import httpx
import logging

from ..models import ReportConfig, EmailConfig, TelegramConfig, SlackConfig

logger = logging.getLogger(__name__)


class ReportService:
    """Service for sending reports via multiple channels"""
    
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    async def send_report(self, report_config: ReportConfig, context: Dict[str, Any]) -> Dict[str, Any]:
        """Send report to all configured channels"""
        results = {}
        
        # Render template and subject with context
        rendered_template = self._render_template(report_config.template or "", context)
        rendered_subject = self._render_template(report_config.subject or "Report", context)
        
        for i, channel in enumerate(report_config.channels):
            channel_key = f"{channel.type}_{i}"
            try:
                if channel.type == "email":
                    result = await self._send_email(channel.config, rendered_subject, rendered_template)
                elif channel.type == "telegram":
                    result = await self._send_telegram(channel.config, rendered_template)
                elif channel.type == "slack":
                    result = await self._send_slack(channel.config, rendered_template)
                else:
                    result = {"success": False, "error": f"Unknown channel type: {channel.type}"}
                
                results[channel_key] = result
                logger.info(f"Report sent via {channel.type}: {result}")
                
            except Exception as e:
                error_msg = f"Failed to send report via {channel.type}: {str(e)}"
                logger.error(error_msg)
                results[channel_key] = {"success": False, "error": error_msg}
        
        return results
    
    def _render_template(self, template: str, context: Dict[str, Any]) -> str:
        """Simple template rendering with variable substitution"""
        rendered = template
        for key, value in context.items():
            placeholder = "{" + key + "}"
            if placeholder in rendered:
                rendered = rendered.replace(placeholder, str(value) if value is not None else "")
        return rendered
    
    async def _send_email(self, config: EmailConfig, subject: str, body: str) -> Dict[str, Any]:
        """Send email via SMTP"""
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = config.from_email
            msg['To'] = ", ".join(config.to_emails)
            msg['Subject'] = subject
            
            # Add body
            msg.attach(MIMEText(body, 'plain'))
            
            # Connect and send
            server = smtplib.SMTP(config.smtp_server, config.smtp_port)
            if config.use_tls:
                server.starttls()
            
            server.login(config.smtp_username, config.smtp_password)
            text = msg.as_string()
            server.sendmail(config.from_email, config.to_emails, text)
            server.quit()
            
            return {
                "success": True, 
                "message": f"Email sent to {len(config.to_emails)} recipients"
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _send_telegram(self, config: TelegramConfig, message: str) -> Dict[str, Any]:
        """Send message via Telegram Bot API"""
        try:
            results = []
            
            for chat_id in config.chat_ids:
                url = f"https://api.telegram.org/bot{config.bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "Markdown"
                }
                
                response = await self.http_client.post(url, json=payload)
                response.raise_for_status()
                
                result = response.json()
                if result.get("ok"):
                    results.append(f"Sent to {chat_id}")
                else:
                    results.append(f"Failed to send to {chat_id}: {result.get('description')}")
            
            return {
                "success": True,
                "message": f"Telegram messages sent: {', '.join(results)}"
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _send_slack(self, config: SlackConfig, message: str) -> Dict[str, Any]:
        """Send message via Slack webhook"""
        try:
            payload = {
                "text": message,
                "username": config.username or "LangFlow Bot"
            }
            
            if config.channel:
                payload["channel"] = config.channel
            
            response = await self.http_client.post(config.webhook_url, json=payload)
            response.raise_for_status()
            
            return {
                "success": True,
                "message": "Slack message sent successfully"
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def close(self):
        """Clean up resources"""
        await self.http_client.aclose()


# Global report service instance
report_service = ReportService() 