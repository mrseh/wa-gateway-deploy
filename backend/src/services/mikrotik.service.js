/**
 * Mikrotik Service
 */

const db = require('../config/database');

class MikrotikService {
  generateScriptForRouter(userId, instanceId, webhookToken) {
    const webhookUrl = `${process.env.APP_URL}/api/v1/webhooks/mikrotik/${webhookToken}`;
    
    return `# WhatsApp Gateway - Mikrotik Monitoring Script
# Generated for User: ${userId}
# Copy this script to your Mikrotik router

# Configuration
:global WAGatewayURL "${webhookUrl}"

# PPPoE Login Script
/ppp secret
:foreach secret in=[find] do={
  /ppp secret set $secret on-login={
    :local username [/ppp secret get $secret name];
    :local interface [/ppp active get [find name=$username] interface];
    :local ip [/ppp active get [find name=$username] address];
    :local mac [/ppp active get [find name=$username] caller-id];
    :local router [/system identity get name];
    :local time [/system clock get time];
    :local date [/system clock get date];
    
    /tool fetch url=$WAGatewayURL mode=http http-method=post \\
      http-data="{\\"event\\":\\"pppoe_login\\",\\"user\\":\\"$username\\",\\"ip\\":\\"$ip\\",\\"mac\\":\\"$mac\\",\\"router\\":\\"$router\\",\\"time\\":\\"$date $time\\"}" \\
      http-header-field="Content-Type: application/json" \\
      keep-result=no;
  }
}

# PPPoE Logout Script  
/ppp secret
:foreach secret in=[find] do={
  /ppp secret set $secret on-logout={
    :local username [/ppp secret get $secret name];
    :local ip [/ppp active get [find name=$username] address];
    :local uptime [/ppp active get [find name=$username] uptime];
    :local download [/ppp active get [find name=$username] bytes-in];
    :local upload [/ppp active get [find name=$username] bytes-out];
    :local router [/system identity get name];
    :local time [/system clock get time];
    :local date [/system clock get date];
    
    /tool fetch url=$WAGatewayURL mode=http http-method=post \\
      http-data="{\\"event\\":\\"pppoe_logout\\",\\"user\\":\\"$username\\",\\"ip\\":\\"$ip\\",\\"uptime\\":\\"$uptime\\",\\"download\\":\\"$download\\",\\"upload\\":\\"$upload\\",\\"router\\":\\"$router\\",\\"time\\":\\"$date $time\\"}" \\
      http-header-field="Content-Type: application/json" \\
      keep-result=no;
  }
}

# Interface Monitor (Check every 1 minute)
/system scheduler add name=interface-monitor interval=1m on-event={
  :local router [/system identity get name];
  :local time [/system clock get time];
  :local date [/system clock get date];
  
  :foreach interface in=[/interface find] do={
    :local ifname [/interface get $interface name];
    :local running [/interface get $interface running];
    
    :if ($running=false) do={
      /tool fetch url=$WAGatewayURL mode=http http-method=post \\
        http-data="{\\"event\\":\\"interface_down\\",\\"interface\\":\\"$ifname\\",\\"router\\":\\"$router\\",\\"time\\":\\"$date $time\\"}" \\
        http-header-field="Content-Type: application/json" \\
        keep-result=no;
    }
  }
}

# Resource Monitor (Check every 5 minutes)
/system scheduler add name=resource-monitor interval=5m on-event={
  :local router [/system identity get name];
  :local cpuload [/system resource get cpu-load];
  :local memory [/system resource get total-memory];
  :local freemem [/system resource get free-memory];
  :local disk [/system resource get total-hdd-space];
  :local freedisk [/system resource get free-hdd-space];
  :local time [/system clock get time];
  :local date [/system clock get date];
  
  :if ($cpuload > 80) do={
    /tool fetch url=$WAGatewayURL mode=http http-method=post \\
      http-data="{\\"event\\":\\"high_cpu\\",\\"cpu\\":\\"$cpuload\\",\\"router\\":\\"$router\\",\\"time\\":\\"$date $time\\"}" \\
      http-header-field="Content-Type: application/json" \\
      keep-result=no;
  }
  
  :local memused ($memory - $freemem);
  :local mempercent (($memused * 100) / $memory);
  
  :if ($mempercent > 90) do={
    /tool fetch url=$WAGatewayURL mode=http http-method=post \\
      http-data="{\\"event\\":\\"high_memory\\",\\"memory_percent\\":\\"$mempercent\\",\\"router\\":\\"$router\\",\\"time\\":\\"$date $time\\"}" \\
      http-header-field="Content-Type: application/json" \\
      keep-result=no;
  }
}`;
  }

  async createDefaultTemplates() {
    const templates = [
      {
        name: 'pppoe_login',
        category: 'mikrotik',
        emoji: '🟢',
        template: `🟢 *PPPoE Login*
━━━━━━━━━━━━━━━
👤 User: {{user}}
🌐 IP: {{ip}}
📱 MAC: {{mac}}
🔧 Router: {{router}}
⏰ Time: {{time}}
━━━━━━━━━━━━━━━`,
        variables: ['user', 'ip', 'mac', 'router', 'time'],
        is_active: true,
        is_default: true,
      },
      {
        name: 'pppoe_logout',
        category: 'mikrotik',
        emoji: '🔴',
        template: `🔴 *PPPoE Logout*
━━━━━━━━━━━━━━━
👤 User: {{user}}
🌐 IP: {{ip}}
⏱️ Duration: {{uptime}}
📊 Download: {{download}}
📈 Upload: {{upload}}
⏰ Time: {{time}}
━━━━━━━━━━━━━━━`,
        variables: ['user', 'ip', 'uptime', 'download', 'upload', 'time'],
        is_active: true,
        is_default: true,
      },
      {
        name: 'interface_down',
        category: 'mikrotik',
        emoji: '⚠️',
        template: `⚠️ *Interface Down Alert*
━━━━━━━━━━━━━━━
🔌 Interface: {{interface}}
🔧 Router: {{router}}
⏰ Time: {{time}}
━━━━━━━━━━━━━━━
❗ Interface is not running!`,
        variables: ['interface', 'router', 'time'],
        is_active: true,
        is_default: true,
      },
      {
        name: 'high_cpu',
        category: 'mikrotik',
        emoji: '🔥',
        template: `🔥 *High CPU Alert*
━━━━━━━━━━━━━━━
🖥️ CPU Load: {{cpu}}%
🔧 Router: {{router}}
⏰ Time: {{time}}
━━━━━━━━━━━━━━━
⚠️ CPU usage is above 80%!`,
        variables: ['cpu', 'router', 'time'],
        is_active: true,
        is_default: true,
      },
      {
        name: 'high_memory',
        category: 'mikrotik',
        emoji: '💾',
        template: `💾 *High Memory Alert*
━━━━━━━━━━━━━━━
📊 Memory Usage: {{memory_percent}}%
🔧 Router: {{router}}
⏰ Time: {{time}}
━━━━━━━━━━━━━━━
⚠️ Memory usage is above 90%!`,
        variables: ['memory_percent', 'router', 'time'],
        is_active: true,
        is_default: true,
      },
    ];

    for (const template of templates) {
      await db.AlertTemplate.findOrCreate({
        where: { name: template.name, is_default: true },
        defaults: template,
      });
    }

    console.log('Default Mikrotik templates created');
  }
}

module.exports = new MikrotikService();
