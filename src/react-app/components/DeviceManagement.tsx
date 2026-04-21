import { useState, useEffect } from 'react';
import { Smartphone, Monitor, Tablet, Trash2, Loader2, Calendar, Clock } from 'lucide-react';

interface Device {
  id: number;
  device_name: string;
  device_type: string;
  last_used_at: string;
  expires_at: string;
  created_at: string;
}

export default function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/device-tokens');
      if (!response.ok) throw new Error('Failed to fetch devices');
      
      const data = await response.json();
      setDevices(data.devices || []);
    } catch (err) {
      setError('Failed to load devices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const revokeDevice = async (deviceId: number) => {
    if (!confirm('Are you sure you want to remove this device? You will need to sign in again on that device.')) {
      return;
    }

    try {
      setRevoking(deviceId);
      const response = await fetch(`/api/auth/device-tokens/${deviceId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to revoke device');
      
      // Remove from local state
      setDevices(devices.filter(d => d.id !== deviceId));
    } catch (err) {
      setError('Failed to revoke device');
      console.error(err);
    } finally {
      setRevoking(null);
    }
  };

  const revokeAllDevices = async () => {
    if (!confirm('Are you sure you want to sign out of all devices? You will need to sign in again on all devices.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/auth/device-tokens', {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to revoke all devices');
      
      // Clear local state
      setDevices([]);
    } catch (err) {
      setError('Failed to revoke all devices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-6 h-6 text-cyan-400" />;
      case 'tablet':
        return <Tablet className="w-6 h-6 text-cyan-400" />;
      default:
        return <Monitor className="w-6 h-6 text-cyan-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Trusted Devices</h2>
          <p className="text-gray-400">Manage devices where you stay signed in</p>
        </div>
        {devices.length > 0 && (
          <button
            onClick={revokeAllDevices}
            className="px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium"
          >
            Sign Out All Devices
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl p-8 text-center">
          <Smartphone className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Trusted Devices</h3>
          <p className="text-gray-400">
            When you check "Remember this device" during sign-in, your devices will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {devices.map((device) => {
            const daysLeft = getDaysUntilExpiry(device.expires_at);
            const isExpiringSoon = daysLeft <= 7;
            
            return (
              <div
                key={device.id}
                className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:border-cyan-500/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="p-3 bg-cyan-500/10 rounded-lg">
                      {getDeviceIcon(device.device_type)}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {device.device_name || 'Unknown Device'}
                      </h3>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>Last used: {formatDate(device.last_used_at)}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>Added: {formatDate(device.created_at)}</span>
                        </div>
                        {isExpiringSoon && (
                          <div className="flex items-center space-x-2 text-sm text-yellow-400">
                            <span>⚠️ Expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => revokeDevice(device.id)}
                    disabled={revoking === device.id}
                    className="ml-4 p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Remove device"
                  >
                    {revoking === device.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
        <p className="text-cyan-400 text-sm">
          <strong>Note:</strong> Trusted devices will automatically sign you in for 30 days. You can revoke access at any time.
        </p>
      </div>
    </div>
  );
}
