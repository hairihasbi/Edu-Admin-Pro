import React, { useState, useEffect } from "react";
import { User, Student, SystemSettings, ClassRoom } from "../types";
import { db } from "../services/db";
import StudentQrGenerator from "./StudentQrGenerator";
import ManualAttendance from "./ManualAttendance";
import { QRCodeSVG } from "qrcode.react";
import {
  getSystemSettings,
  saveSystemSettings,
  getSchoolStudents,
  getSchoolClasses,
  updateStudentRfid,
} from "../services/database";
import {
  Shield,
  Activity,
  IdCard,
  Settings,
  Search,
  Trash2,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Server,
  Smartphone,
  Zap,
  Clock,
  Save,
  Info,
  QrCode,
  Printer,
  Download,
  ClipboardList,
  Filter,
} from "./Icons";

interface RfidSecurityManagerProps {
  user: User;
}

type TabType = "CONTROL" | "SECURITY" | "CARD" | "QR" | "MANUAL";

const RfidSecurityManager: React.FC<RfidSecurityManagerProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<TabType>("CONTROL");
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeDevices, setActiveDevices] = useState<
    { id: string; lastSeen: string; method: string }[]
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [sysSettings, schoolStudents, schoolClasses] = await Promise.all([
      getSystemSettings(),
      getSchoolStudents(user.schoolNpsn || ""),
      getSchoolClasses(user.schoolNpsn || ""),
    ]);

    setSettings(sysSettings || null);
    setStudents(schoolStudents);
    setClasses(schoolClasses);

    // Simulated Active Devices from Logs
    const recentLogs = await db.rfidLogs
      .where("schoolNpsn")
      .equals(user.schoolNpsn || "")
      .reverse()
      .limit(100)
      .toArray();

    const devicesMap = new Map();
    recentLogs.forEach((log) => {
      const dId = log.deviceId || "Pos-Utama";
      if (!devicesMap.has(dId)) {
        devicesMap.set(dId, {
          id: dId,
          lastSeen: log.timestamp,
          method: log.method,
        });
      }
    });
    setActiveDevices(Array.from(devicesMap.values()));

    setLoading(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const success = await saveSystemSettings(settings);
    if (success) {
      alert("Konfigurasi Keamanan RFID Berhasil Disimpan");
    }
    setSaving(false);
  };

  const handleBlockCard = async (student: Student) => {
    if (
      !window.confirm(
        `Blokir kartu untuk ${student.name}? Kartu lama tidak akan bisa digunakan lagi.`,
      )
    )
      return;

    const blockedTag = student.rfidTag;
    const currentBlocked = settings?.rfidBlockedTags || [];

    const updatedSettings = {
      ...settings!,
      rfidBlockedTags: blockedTag
        ? [...currentBlocked, blockedTag]
        : currentBlocked,
    };

    const success = await updateStudentRfid(student.id, ""); // Clear tag from student
    if (success) {
      await saveSystemSettings(updatedSettings);
      setSettings(updatedSettings);
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, rfidTag: "" } : s)),
      );
    }
  };

  const [pairingStudentId, setPairingStudentId] = useState<string | null>(null);
  const [newTagId, setNewTagId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");

  const handlePairCard = async () => {
    if (!pairingStudentId || !newTagId) return;
    setSaving(true);
    try {
      const success = await updateStudentRfid(
        pairingStudentId,
        newTagId.trim(),
      );
      if (success) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === pairingStudentId ? { ...s, rfidTag: newTagId.trim() } : s,
          ),
        );
        setPairingStudentId(null);
        setNewTagId("");
        alert("Pemasangan Kartu RFID Berhasil");
      }
    } catch (e) {
      alert("Gagal memasangkan kartu");
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(
    (s) => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nis.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.rfidTag && s.rfidTag.includes(searchTerm));
      
      const matchesClass = selectedClassId === "ALL" || s.classId === selectedClassId;
      
      return matchesSearch && matchesClass;
    }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Manajemen & Keamanan RFID
            </h2>
            <p className="text-sm text-gray-500">
              Pusat konfigurasi teknis dan operasional kartu RFID sekolah.
            </p>
          </div>
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-xs font-bold border border-blue-100 flex items-center gap-2">
            <Smartphone size={16} />
            ID Sekolah: {user.schoolNpsn}
          </div>
        </div>

        <div className="flex p-1 bg-gray-100 rounded-xl w-full max-w-md">
          <button
            onClick={() => setActiveTab("CONTROL")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${activeTab === "CONTROL" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Activity size={18} /> Pusat Kendali
          </button>
          <button
            onClick={() => setActiveTab("SECURITY")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${activeTab === "SECURITY" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Shield size={18} /> Keamanan
          </button>
          <button
            onClick={() => setActiveTab("CARD")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${activeTab === "CARD" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <IdCard size={18} /> Layanan Kartu
          </button>
          <button
            onClick={() => setActiveTab("QR")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${activeTab === "QR" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <QrCode size={18} /> Generator QR
          </button>
          <button
            onClick={() => setActiveTab("MANUAL")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${activeTab === "MANUAL" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <ClipboardList size={18} /> Manual
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === "CONTROL" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Server size={18} className="text-blue-500" />
                  Monitoring Status Alat (Scanner)
                </h3>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                  LIVE
                </span>
              </div>
              <div className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                    <tr>
                      <th className="p-4">Identitas Perangkat</th>
                      <th className="p-4">Terakhir Aktif</th>
                      <th className="p-4">Metode</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeDevices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-12 text-center text-gray-400 italic"
                        >
                          Belum ada perangkat yang tercatat melakukan scanning
                          hari ini.
                        </td>
                      </tr>
                    ) : (
                      activeDevices.map((device) => (
                        <tr key={device.id}>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                                <Smartphone size={20} />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">
                                  {device.id}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                  Pos Scanner Aktif
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-gray-600">
                            {new Date(device.lastSeen).toLocaleTimeString(
                              "id-ID",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                            <span className="block text-[10px] text-gray-400">
                              {new Date(device.lastSeen).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${device.method === "SERIAL" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"}`}
                            >
                              {device.method}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5 text-green-600 font-bold text-xs">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                              ONLINE
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg border border-blue-500/20 relative overflow-hidden">
              <Zap className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
              <h3 className="text-lg font-bold mb-2">Remote Configuration</h3>
              <p className="text-sm text-blue-100 mb-6 font-medium">
                Pengaturan Keamanan dan Jam Absensi yang Anda ubah di sini akan
                otomatis sinkron ke seluruh terminal di sekolah.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/20">
                  <Clock size={24} className="text-blue-200" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-blue-200">
                      Jam Masuk
                    </p>
                    <p className="font-bold">
                      {settings?.rfidCheckInLate || "-"} WIB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/20">
                  <Shield size={24} className="text-blue-200" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-blue-200">
                      Antrian Tap
                    </p>
                    <p className="font-bold">
                      {settings?.rfidCooldownSeconds || "0"} Detik
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "SECURITY" && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800">
                Security Rules (Aturan Keamanan)
              </h3>
              <p className="text-xs text-gray-500">
                Aturan pencegahan kecurangan dan kesalahan tapping kartu.
              </p>
            </div>
            <button
              disabled={saving}
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition"
            >
              {saving ? (
                <RotateCcw size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Simpan Aturan
            </button>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Cooldown Tapping</h4>
                  <p className="text-[10px] text-gray-500 italic">
                    Mencegah kartu di-tap berkali-kali secara tidak sengaja.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Durasi Cooldown (Detik)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={settings?.rfidCooldownSeconds || 0}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            rfidCooldownSeconds: parseInt(e.target.value),
                          }
                        : null,
                    )
                  }
                  placeholder="Contoh: 10"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  *Terminal akan menolak kartu yang sama sebelum durasi ini
                  berakhir.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <Zap size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">
                    Anti-Duplicate Prevention
                  </h4>
                  <p className="text-[10px] text-gray-500 italic">
                    Mencegah satu kartu absen di dua pos dalam waktu cepat.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Ambang Batas Duplikasi (Menit)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={settings?.rfidAntiDuplicateMinutes || 0}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            rfidAntiDuplicateMinutes: parseInt(e.target.value),
                          }
                        : null,
                    )
                  }
                  placeholder="Contoh: 5"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  *Mencegah tapping jika baru saja tap di alat lain dalam
                  rentang menit ini.
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 bg-rose-50 border-t border-rose-100">
            <h4 className="font-bold text-rose-800 flex items-center gap-2 mb-2 text-sm">
              <AlertTriangle size={18} /> Daftar Hitam Kartu (Blocked List)
            </h4>
            <div className="flex flex-wrap gap-2">
              {settings?.rfidBlockedTags &&
              settings.rfidBlockedTags.length > 0 ? (
                settings.rfidBlockedTags.map((tag, i) => (
                  <div
                    key={i}
                    className="px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded-full text-[10px] font-mono font-bold flex items-center gap-2"
                  >
                    {tag}
                    <button
                      onClick={() =>
                        setSettings((prev) =>
                          prev
                            ? {
                                ...prev,
                                rfidBlockedTags: prev.rfidBlockedTags?.filter(
                                  (t) => t !== tag,
                                ),
                              }
                            : null,
                        )
                      }
                      className="hover:text-rose-900"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-rose-400 italic">
                  Belum ada kartu yang diblokir.
                </p>
              )}
            </div>
          </div>
        </form>
      )}

      {activeTab === "CARD" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-800">
                Layanan & Penggantian Kartu
              </h3>
              <p className="text-xs text-gray-500">
                Tangani laporan kartu hilang dan pendaftaran ulang kartu siswa.
              </p>
            </div>
            <div className="relative w-full md:w-64">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Cari Nama/NIS/ID Kartu..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Tab Kelas */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 overflow-x-auto flex gap-2 scrollbar-none">
            <button
              onClick={() => setSelectedClassId("ALL")}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition ${selectedClassId === "ALL" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"}`}
            >
              SEMUA KELAS
            </button>
            {classes.sort((a,b) => a.name.localeCompare(b.name)).map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition ${selectedClassId === cls.id ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"}`}
              >
                {cls.name.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="bg-blue-50/50 p-4 border-b border-blue-50 flex gap-3 text-blue-800 text-[10px]">
            <Info size={16} className="shrink-0" />
            <p>
              <strong>Panduan Cepat:</strong> Gunakan tombol{" "}
              <RotateCcw size={12} className="inline" />{" "}
              <strong>Pairing Ulang</strong> jika siswa membawa kartu baru. ID
              kartu lama akan otomatis terhapus dari data siswa tersebut.
              Gunakan tombol <Trash2 size={12} className="inline" />{" "}
              <strong>Blokir</strong> jika kartu hilang agar ID tersebut masuk
              ke Daftar Hitam keamanan.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                <tr>
                  <th className="p-4">Siswa</th>
                  <th className="p-4">Kelas</th>
                  <th className="p-4 font-mono">ID Kartu (RFID)</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-12 text-center text-gray-400 italic"
                    >
                      Data siswa tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">
                              {student.name}
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono">
                              NIS: {student.nis}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase">
                          {classes.find((c) => c.id === student.classId)
                            ?.name || "TPS"}
                        </span>
                      </td>
                      <td className="p-4">
                        {student.rfidTag ? (
                          <div className="flex items-center gap-2 text-blue-600 font-mono font-bold text-xs">
                            <CheckCircle size={14} className="text-green-500" />
                            {student.rfidTag}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">
                            Belum Ada Kartu
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          {student.rfidTag ? (
                            <>
                              <button
                                onClick={() => handleBlockCard(student)}
                                title="Blokir & Hapus Kartu"
                                className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition"
                              >
                                <Trash2 size={16} />
                              </button>
                              <button
                                onClick={() => setPairingStudentId(student.id)}
                                title="Pairing Ulang"
                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition"
                              >
                                <RotateCcw size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setPairingStudentId(student.id)}
                              title="Daftarkan Sekarang"
                              className="px-3 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700 transition"
                            >
                              DAFTARKAN
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "QR" && (
        <StudentQrGenerator students={students} classes={classes} />
      )}

      {activeTab === "MANUAL" && (
        <ManualAttendance students={students} classes={classes} user={user} />
      )}

      {/* Pairing Modal */}
      {pairingStudentId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                Pairing Kartu Baru
              </h3>
              <button
                onClick={() => setPairingStudentId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <RotateCcw size={20} className="rotate-45" />
              </button>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
                {students
                  .find((s) => s.id === pairingStudentId)
                  ?.name.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-blue-800">
                  {students.find((s) => s.id === pairingStudentId)?.name}
                </p>
                <p className="text-[10px] text-blue-600">
                  NIS: {students.find((s) => s.id === pairingStudentId)?.nis}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">
                ID Kartu (RFID Tag)
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Scan atau ketik ID Kartu..."
                className="w-full p-3 border border-gray-200 rounded-xl font-mono text-center text-lg font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                value={newTagId}
                onChange={(e) => setNewTagId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePairCard()}
              />
              <p className="text-[10px] text-gray-400 mt-2 italic text-center italic">
                Tip: Tempelkan kartu pada alat saat kursor berada di kotak ini.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPairingStudentId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handlePairCard}
                disabled={!newTagId || saving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? "Proses..." : "Pasangkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RfidSecurityManager;
