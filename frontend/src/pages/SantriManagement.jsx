import { useState, useEffect, useRef } from 'react';
import {
  Container, Card, Button, Table, Modal, Form,
  Badge, Row, Col, InputGroup, Alert
} from 'react-bootstrap';
import { santriAPI } from '../api';
import { QRCodeCanvas } from 'qrcode.react';
import { usePopup } from '../components/Popup';
import { useAuth } from '../context/AuthContext';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import * as XLSX from 'xlsx';
import 'bootstrap-icons/font/bootstrap-icons.css';

function SantriManagement() {
  const { showAlert, showConfirm } = usePopup();
  const { user } = useAuth();
  const [santri, setSantri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedSantri, setSelectedSantri] = useState(null);
  const [formData, setFormData] = useState({
    nama: '',
    nis: '',
    kelas: '',
    statusBaru: 'lama', // 'lama' = siswa lama, 'baru' = siswa baru
    tanggal_lahir: '',
    alamat: '',
    no_hp_ortu: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const qrRef = useRef(null);

  // Bulk add state
  const [bulkAddMode, setBulkAddMode] = useState(false);
  const [bulkQuantity, setBulkQuantity] = useState(1);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Check if user is admin
  const isAdmin = user?.email === 'adminizin@gmail.com';

  // Import Excel states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [fileData, setFileData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef(null);

  const [selectedSantriForBulkQR, setSelectedSantriForBulkQR] = useState([]);
  const [showBulkQRModal, setShowBulkQRModal] = useState(false);
  const [santriToPrint, setSantriToPrint] = useState([]);
  useEffect(() => {
    fetchSantri();
  }, []);

  const fetchSantri = async () => {
    try {
      const response = await santriAPI.getAll();
      const result = response.data;
      if (result.success) {
        setSantri(result.data || []);
        setNetworkError(false);
      }
    } catch (error) {
      console.error('Error fetching santri:', error);
      if (error.code === 'unavailable' || error.code === 'permission-denied') {
        setNetworkError(true);
      } else {
        showAlert('danger', 'Gagal memuat data: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) {
      showAlert('danger', 'Tidak ada file yang dipilih');
      return;
    }

    setImportFile(file);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(uint8Array, { type: 'array' });
        
        console.log('Total sheets:', workbook.SheetNames);
        
        // Auto-detect columns and combine data from ALL sheets
        let jsonData = [];
        
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(sheet);
          
          if (rawData.length === 0) continue;
          
          // Detect format: SMK PSAS has 'DATA SISWA SMK AL-ITTIHAD' column (case-insensitive partial match)
          const firstRow = rawData[0];
          const firstRowKeys = Object.keys(firstRow);
          const isSMKPSASFormat = firstRowKeys.some(key => key.toUpperCase().includes('DATA SISWA SMK AL-ITTIHAD'));

          // Find the actual SMK column key for later use
          const smkColumnKey = firstRowKeys.find(key => key.toUpperCase().includes('DATA SISWA SMK AL-ITTIHAD'));
          
          let sheetData = [];
          
          if (isSMKPSASFormat) {
            // SMK PSAS format: smart detection
            let currentKelas = sheetName;

            for (let i = 0; i < rawData.length; i++) {
              const row = rawData[i];
              const cell0 = row[smkColumnKey];

              // Detect kelas header (e.g., 'Kelas X A SMK', 'Kelas XI', 'Kelas XII', 'KELAS XII A PPLG PUTRA')
              if (typeof cell0 === 'string' && cell0.toUpperCase().startsWith('KELAS')) {
                currentKelas = cell0.replace(/^KELAS\s+/i, '').trim();
                if (!currentKelas) {
                  currentKelas = cell0.substring(5).trim(); // fallback: just remove first 5 chars
                }
                continue;
              }

              // Skip header rows
              if (cell0 === 'NO.' || 
                  (typeof cell0 === 'string' && cell0.toUpperCase().startsWith('TAHUN PELAJARAN')) || 
                  (typeof cell0 === 'string' && cell0.toUpperCase().startsWith('DATA SISWA')) ||
                  cell0 === undefined) {
                continue;
              }

              // Auto-detect NIS, NAMA, STATUS from __EMPTY columns
              const nis = row['__EMPTY'] || row['NIS'] || row['nis'] || row['Nis'];
              const nama = row['__EMPTY_2'] || row['NAMA LENGKAP'] || row['NAMA'] || row['Nama'];
              const status = row['__EMPTY_1'] || row['STATUS'] || row['Status'] || 'LAMA';
              const kelas = row['__EMPTY_3'] || currentKelas || sheetName;
              
              if (nis && nama) {
                sheetData.push({
                  NO: row['DATA SISWA SMK AL-ITTIHAD'],
                  NIS: nis,
                  STATUS: status,
                  NAMA: nama,
                  KELAS: kelas
                });
              }
            }
          } else {
            // Standard or unknown format: auto-detect columns
            for (const row of rawData) {
              // Auto-detect NIS
              const nis = row.NIS || row.nis || row.Nis || 
                          row['Nomor Induk'] || row['nomor_induk'] ||
                          row['No Induk'] || row['no_induk'] ||
                          row['NO'] || row['No'] || row['no'];
              
              // Auto-detect NAMA
              const nama = row.NAMA || row.nama || row.Nama || 
                           row['NAMA LENGKAP'] || row['Nama Lengkap'] ||
                           row['nama_lengkap'] || row['NAMA_LENGKAP'] ||
                           row['Nama Lengkap'] || row['nama'];
              
              // Auto-detect STATUS
              const status = row.STATUS || row.status || row.Status || 
                             row['KETERANGAN'] || row['Keterangan'] ||
                             row['JENIS'] || row['Jenis'] || 'LAMA';
              
              // Auto-detect KELAS
              const kelas = row.KELAS || row.kelas || row.Kelas ||
                            row['ROMBONGAN BELAJAR'] || row['Rombel'] ||
                            row['rombel'] || row['Kelas'];
              
              if (nis && nama) {
                sheetData.push({
                  NIS: nis,
                  STATUS: status,
                  NAMA: nama,
                  KELAS: kelas || ''
                });
              }
            }
          }
          
          console.log('Sheet', sheetName + ':', sheetData.length, 'students');
          jsonData = jsonData.concat(sheetData);
        }
        
        if (jsonData.length === 0) {
          showAlert('danger', 'Tidak ada data santri yang ditemukan. Pastikan file memiliki kolom NIS dan NAMA!');
          return;
        }
        
        setImportPreview(jsonData.slice(0, 5));
        setFileData(jsonData);
        
        showAlert('success', 'File berhasil dibaca! ' + jsonData.length + ' data santri dari ' + workbook.SheetNames.length + ' sheet.');
      } catch (error) {
        console.error('Error parsing Excel:', error);
        showAlert('danger', 'Gagal membaca file Excel: ' + error.message);
      }
    };
    
    reader.onerror = () => {
      showAlert('danger', 'Gagal membaca file. Pastikan file tidak corrupt.');
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!fileData || fileData.length === 0) {
      showAlert('danger', 'Tidak ada data untuk diimport!');
      return;
    }

    // Show warning for large imports
    if (fileData.length > 100) {
      const confirmed = await showConfirm({
        title: `Import ${fileData.length} Data?`,
        message: `Jumlah data cukup besar (${fileData.length}). Proses akan memakan waktu. Lanjutkan?`,
        icon: 'bi-info-circle text-warning',
        confirmText: 'Ya, Import',
        cancelText: 'Batal'
      });
      
      if (!confirmed) return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: fileData.length });
    let successCount = 0;
    let errorCount = 0;
    let firstError = '';

    try {
      for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        setImportProgress({ current: i + 1, total: fileData.length });

        try {
          // Map Excel columns to form data
          // Support both standard format and SMK PSAS format
          const rawStatus = (row.STATUS || row.status || row.Status || '').trim().toLowerCase();
          const santriData = {
            nama: ((row.NAMA || row.nama || row.Nama) || (row.NAMA_LENGKAP || row['NAMA LENGKAP']) || '').trim(),
            nis: String(row.NIS || row.nis || row.Nis || '').trim(),
            kelas: ((row.KELAS || row.kelas || row.Kelas) || '').trim(),
            statusBaru: (rawStatus && rawStatus !== '-' && rawStatus !== 'null' && rawStatus !== 'undefined') ? rawStatus : 'lama',
            tanggal_lahir: ((row.TANGGAL_LAHIR || row.tanggal_lahir || row.Tanggal_Lahir) || '').trim(),
            alamat: ((row.ALAMAT || row.alamat || row.Alamat) || '').trim(),
            no_hp_ortu: ((row.NO_HP_ORTU || row.no_hp_ortu || row.No_HP_Ortu) || '').trim()
          };

          // Validate required fields (NAMA dan NIS wajib)
          if (!santriData.nama || !santriData.nis) {
            console.warn(`Row ${i + 1} skipped: nama="${santriData.nama}", nis="${santriData.nis}"`);
            errorCount++;
            if (!firstError) firstError = `Baris ${i + 1}: NAMA="${santriData.nama}" atau NIS="${santriData.nis}" kosong`;
            continue;
          }

          // Retry mechanism for failed writes
          let retries = 0;
          let imported = false;
          
          while (retries < 3 && !imported) {
            try {
              await santriAPI.create(santriData);
              successCount++;
              imported = true;
            } catch (retryErr) {
              retries++;
              if (retries < 3) {
                console.log(`Row ${i + 1} retry ${retries}/3...`);
                await new Promise(r => setTimeout(r, 1000 * retries)); // Wait 1s, 2s, 3s
              } else {
                throw retryErr;
              }
            }
          }
          
          // Small delay to avoid Firebase rate limit (50ms per request)
          await new Promise(r => setTimeout(r, 50));
          
        } catch (err) {
          console.error(`Row ${i + 1} failed:`, err);
          errorCount++;
          if (!firstError) firstError = `Baris ${i + 1}: ${err.message || err.code || 'Unknown error'}`;
        }
      }

      const resultMsg = `Import selesai! ${successCount} berhasil, ${errorCount} gagal.`;
      if (firstError && successCount === 0) {
        showAlert('danger', resultMsg + '\nError pertama: ' + firstError);
      } else {
        showAlert(successCount > 0 ? 'success' : 'warning', resultMsg);
      }
      
      if (successCount > 0) {
        setShowImportModal(false);
        setImportFile(null);
        setImportPreview([]);
        setFileData(null);
        fetchSantri();
      }
    } catch (error) {
      console.error('Import error:', error);
      showAlert('danger', 'Error saat import: ' + error.message);
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };
  const handleShowModal = (santri = null) => {
    if (santri) {
      setEditMode(true);
      setBulkAddMode(false);
      setSelectedSantri(santri);
      setFormData({
        nama: santri.nama,
        nis: santri.nis,
        kelas: santri.kelas,
        statusBaru: santri.statusBaru || 'lama',
        tanggal_lahir: santri.tanggal_lahir || '',
        alamat: santri.alamat || '',
        no_hp_ortu: santri.no_hp_ortu || '',
        status_aktif: santri.statusAktif ?? santri.status_aktif ?? true
      });
    } else {
      setEditMode(false);
      setBulkAddMode(false);
      setSelectedSantri(null);
      setBulkQuantity(1);
      setFormData({
        nama: '',
        nis: '',
        kelas: '',
        statusBaru: 'lama',
        tanggal_lahir: '',
        alamat: '',
        no_hp_ortu: '',
        status_aktif: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSantri(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);

      if (editMode && selectedSantri) {
        const updateData = {
          nama: formData.nama,
          kelas: formData.kelas,
          statusBaru: formData.statusBaru,
          tanggal_lahir: formData.tanggal_lahir,
          alamat: formData.alamat,
          no_hp_ortu: formData.no_hp_ortu,
          statusAktif: formData.status_aktif ?? true
        };
        const response = await santriAPI.update(selectedSantri.id, updateData);
        const result = response.data;
        if (result.success) {
          showAlert('success', result.message || 'Santri berhasil diupdate!');
        }
      } else if (bulkAddMode && bulkQuantity > 1) {
        // Bulk add mode
        if (!formData.nama || !formData.nis || !formData.kelas) {
          showAlert('danger', 'Nama, NIS, dan Kelas harus diisi!');
          setSubmitting(false);
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        let firstCreated = null;

        for (let i = 0; i < bulkQuantity; i++) {
          try {
            const bulkData = {
              nama: bulkQuantity === 1 ? formData.nama : `${formData.nama} ${i + 1}`,
              nis: String(parseInt(formData.nis) + i),
              kelas: formData.kelas,
              statusBaru: formData.statusBaru || 'lama',
              tanggal_lahir: formData.tanggal_lahir || '',
              alamat: formData.alamat || '',
              no_hp_ortu: formData.no_hp_ortu || ''
            };

            const response = await santriAPI.create(bulkData);
            const result = response.data;
            if (result.success) {
              successCount++;
              if (!firstCreated) firstCreated = result.data;
            }
          } catch (err) {
            console.error(`Bulk add ${i + 1} failed:`, err);
            errorCount++;
          }
        }

        if (successCount > 0) {
          setSelectedSantri(firstCreated);
          showAlert('success', `Berhasil menambahkan ${successCount} santri!${errorCount > 0 ? ` (${errorCount} gagal)` : ''}`);
          if (successCount === 1) setShowQRModal(true);
        } else {
          showAlert('danger', 'Gagal menambahkan santri!');
        }
      } else {
        // Single add mode
        if (!formData.nama || !formData.nis || !formData.kelas) {
          showAlert('danger', 'Nama, NIS, dan Kelas harus diisi!');
          setSubmitting(false);
          return;
        }
        const response = await santriAPI.create(formData);
        const result = response.data;
        if (result.success) {
          setSelectedSantri(result.data);
          showAlert('success', result.message || 'Santri berhasil ditambahkan!');
          setShowQRModal(true);
        }
      }
      handleCloseModal();
      fetchSantri();
    } catch (error) {
      const errorMessage = error.message || 'Terjadi kesalahan';
      showAlert('danger', 'Error: ' + errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (s) => {
    // Tahap 1: Konfirmasi awal
    const confirmed1 = await showConfirm({
      title: 'Hapus Santri?',
      message: `Apakah Anda yakin ingin menghapus data santri "${s.nama}"?`,
      icon: 'bi-person-x-fill text-warning',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal'
    });

    if (!confirmed1) return;

    // Tahap 2: Konfirmasi ketik "HAPUS"
    const confirmText = await showConfirm({
      title: 'Konfirmasi Hapus',
      message: 'Ketik "HAPUS" untuk melanjutkan. Tindakan ini tidak bisa dibatalkan!',
      icon: 'bi-exclamation-triangle-fill text-danger',
      requireInput: true,
      expectedInput: 'HAPUS',
      inputPlaceholder: 'Ketik: HAPUS',
      confirmText: 'Hapus Permanen',
      confirmVariant: 'danger'
    });

    if (confirmText === null || confirmText === false) return; // Abaikan jika user klik batal

    if (confirmText !== 'HAPUS') {
      showAlert('danger', 'Konfirmasi tidak sesuai!');
      return;
    }

    try {
      await santriAPI.delete(s.id);
      // Update state locally for instant UI update
      setSantri(prev => prev.filter(x => x.id !== s.id));
      showAlert('success', 'Santri berhasil dihapus!');
    } catch (error) {
      showAlert('danger', 'Error: ' + error.message);
    }
  };

  const handleDeleteAll = async () => {
    // Tahap 1: Konfirmasi jumlah data
    const confirmed1 = await showConfirm({
      title: `Hapus ${santri.length} Data Santri?`,
      message: `Semua ${santri.length} santri beserta data izin, akses log, dan denda akan dihapus permanen!`,
      icon: 'bi-exclamation-triangle-fill text-danger',
      confirmText: 'Ya, Hapus Semua',
      cancelText: 'Batal'
    });

    if (!confirmed1) return;

    // Tahap 2: Konfirmasi ketik "HAPUS SEMUA"
    const confirmText = await showConfirm({
      title: 'Konfirmasi Hapus Semua',
      message: 'Ketik "HAPUS SEMUA" untuk melanjutkan. Tindakan ini TIDAK BISA dibatalkan!',
      icon: 'bi-exclamation-triangle-fill text-danger',
      requireInput: true,
      expectedInput: 'HAPUS SEMUA',
      inputPlaceholder: 'Ketik: HAPUS SEMUA',
      confirmText: 'Hapus Permanen',
      confirmVariant: 'danger'
    });

    if (confirmText === null || confirmText === false) return; // Abaikan jika user klik batal

    if (confirmText !== 'HAPUS SEMUA') {
      showAlert('danger', 'Konfirmasi tidak sesuai!');
      return;
    }

    // Delete all santri
    try {
      let successCount = 0;
      let errorCount = 0;

      // Create a copy of the array to iterate over
      const santriToDelete = [...santri];
      
      // Update UI immediately for better UX
      setSantri([]);
      setLoading(true);
      
      for (const s of santriToDelete) {
        try {
          await santriAPI.forceDelete(s.id, 'HAPUS_SEMUA_DATA');
          successCount++;
        } catch (err) {
          console.error(`Failed to delete ${s.nama}:`, err);
          errorCount++;
        }
      }

      // Fetch fresh data to sync with Firebase
      await fetchSantri();

      if (errorCount === 0) {
        showAlert('success', `Berhasil menghapus semua ${successCount} data santri!`);
      } else {
        showAlert('warning', `${successCount} berhasil dihapus, ${errorCount} gagal.`);
      }
    } catch (error) {
      console.error('Delete all error:', error);
      showAlert('danger', 'Error saat menghapus: ' + error.message);
    }
  };

  const handleShowQR = async (santri) => {
    try {
      const response = await santriAPI.getQRCode(santri.id);
      const result = response.data;
      if (result.success) {
        setSelectedSantri(result.data);
        setShowQRModal(true);
      }
    } catch (error) {
      showAlert('danger', 'Error: ' + error.message);
    }
  };

  const handleDownloadQR = async () => {
    if (!selectedSantri) {
      showAlert('danger', 'Tidak ada data santri untuk diunduh');
      return;
    }

    // Give QR code time to render
    await new Promise(resolve => setTimeout(resolve, 300));

    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) {
      console.error('Canvas not found');
      showAlert('danger', 'Gagal membuat QR Code. Coba lagi.');
      return;
    }

    setDownloading(true);
    try {
      const fileName = `qr-code-${selectedSantri.nis}.png`;

      if (Capacitor.isNativePlatform()) {
        // For native (Android/iOS)
        const base64Data = canvas.toDataURL('image/png').split(',')[1];
        
        // Save to device
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
        });

        if (savedFile.uri) {
          // Share the saved file (opens share dialog with save options)
          await Share.share({
            title: 'QR Code Santri',
            text: `QR Code untuk ${selectedSantri.nama}`,
            url: savedFile.uri,
            dialogTitle: 'Simpan QR Code'
          });
          showAlert('success', 'QR Code berhasil disimpan!');
        }
      } else {
        // For web browser
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert('success', 'QR Code berhasil didownload!');
      }
    } catch (error) {
      console.error('Error saving QR:', error);
      showAlert('danger', 'Gagal menyimpan QR Code: ' + error.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      // Tambahkan santri di halaman ini yang belum terpilih ke dalam list
      const newIds = paginatedSantri.map(s => s.id).filter(id => !selectedSantriForBulkQR.includes(id));
      setSelectedSantriForBulkQR(prev => [...prev, ...newIds]);
    } else {
      // Hanya hapus centang santri yang sedang tampil di halaman ini
      const pageIds = paginatedSantri.map(s => s.id);
      setSelectedSantriForBulkQR(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  const handleToggleSelectSantri = (santriId) => {
    setSelectedSantriForBulkQR(prev =>
      prev.includes(santriId)
        ? prev.filter(id => id !== santriId)
        : [...prev, santriId]
    );
  };

  const handlePrintBulkQR = () => {
    if (selectedSantriForBulkQR.length === 0) {
      showAlert('warning', 'Pilih setidaknya satu santri untuk mencetak QR Code.');
      return;
    }
    const santriObjects = santri.filter(s => selectedSantriForBulkQR.includes(s.id));
    setSantriToPrint(santriObjects);
    setShowBulkQRModal(true);
  };
  const filteredSantri = santri.filter(s =>
    s.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.nis.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.kelas.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalItems = filteredSantri.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSantri = filteredSantri.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Reset to page 1 when search term changes
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  return (
    <Container className="page-content">
      {/* Page Header */}
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">
          <i className="bi bi-people"></i>
          Data Santri
        </h2>
            {selectedSantriForBulkQR.length > 0 && (
              <Button
                variant="outline-info"
                onClick={handlePrintBulkQR}
              >
                <i className="bi bi-qr-code-scan me-1"></i> Cetak QR Massal ({selectedSantriForBulkQR.length})
              </Button>
            )}
        <div className="d-flex gap-2">
          {isAdmin && (
            <Button variant="outline-danger" onClick={handleDeleteAll} disabled={santri.length === 0}>
              <i className="bi bi-trash3 me-1"></i>
              Hapus Semua
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline-success" onClick={() => setShowImportModal(true)}>
              <i className="bi bi-file-earmark-excel me-1"></i>
              Import Excel
            </Button>
          )}
          {isAdmin && (
            <Button variant="primary" onClick={() => handleShowModal()}>
              <i className="bi bi-plus-lg"></i>
              Tambah Santri Baru
            </Button>
          )}
        </div>
      </div>

      {/* Network Error Alert */}
      {networkError && (
        <Alert variant="danger" className="border-0 mb-4">
          <div className="d-flex align-items-start">
            <i className="bi bi-wifi-off fs-4 me-2 mt-1"></i>
            <div>
              <strong>Tidak dapat terhubung ke Firebase</strong>
              <p className="small mb-1 mt-1">
                Pastikan konfigurasi Firebase sudah benar dan koneksi internet tersedia.
              </p>
              <small className="text-muted">
                Periksa file <code>firebase.js</code> dan pastikan konfigurasi Firebase sudah benar.
              </small>
              <div className="mt-2">
                <Button variant="outline-danger" size="sm" onClick={() => { setLoading(true); fetchSantri(); }}>
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Coba Lagi
                </Button>
              </div>
            </div>
          </div>
        </Alert>
      )}

      {/* Search Bar */}
      <Card className="mb-4 border-0">
        <Card.Body>
          <div className="search-box">
            <i className="bi bi-search"></i>
            <Form.Control
              placeholder="Cari berdasarkan nama, NIS, atau kelas..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
        </Card.Body>
      </Card>

      {/* Santri Table */}
      <Card className="border-0">
        <Card.Body className="p-0">
          {loading ? (
            <div className="loading-state py-5">
              <div>
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted">Memuat data santri...</p>
              </div>
            </div>
          ) : filteredSantri.length === 0 ? (
            <div className="empty-state py-5">
              <i className="bi bi-inbox"></i>
              <p className="mb-0">
                {searchTerm ? 'Tidak ada santri yang ditemukan' : 'Belum ada data santri'}
              </p>
              {!searchTerm && (
                <Button variant="primary" className="mt-3" onClick={() => handleShowModal()}>
                  <i className="bi bi-plus-lg"></i>
                  Tambah Santri Pertama
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-responsive table-desktop-only d-none d-md-block">
                <Table striped hover responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>
                        <Form.Check
                          type="checkbox"
                          onChange={handleToggleSelectAll}
                          checked={paginatedSantri.length > 0 && paginatedSantri.every(s => selectedSantriForBulkQR.includes(s.id))}
                          disabled={paginatedSantri.length === 0}
                        />
                      </th>
                      <th className="ps-4">No</th>
                      <th>Nama</th>
                      <th>NIS</th>
                      <th>Kelas</th>
                      <th>Status</th>
                      <th>Aktif</th>
                      <th>No HP Ortu</th>
                      <th className="text-end pe-4">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSantri.map((s, idx) => (
                      <tr key={s.id}>
                        <td> {/* Correctly wrap Form.Check in <td> */}
                          <Form.Check
                            type="checkbox"
                            checked={selectedSantriForBulkQR.includes(s.id)}
                            onChange={() => handleToggleSelectSantri(s.id)}
                          />
                        </td>
                        <td className="ps-4 fw-medium">{startIndex + idx + 1}</td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="avatar-circle me-2">
                              <i className="bi bi-person-circle text-muted"></i>
                            </div>
                            <span className="fw-medium">{s.nama}</span>
                          </div>
                        </td>
                        <td className="text-muted">{s.nis}</td>
                        <td>
                          <span className="badge bg-secondary">{s.kelas}</span>
                        </td>
                        <td>
                          <Badge className={(s.statusBaru || 'lama') === 'baru' ? 'bg-info' : 'bg-warning text-dark'}>
                            <i className={`bi bi-${(s.statusBaru || 'lama') === 'baru' ? 'person-plus' : 'person'} me-1`}></i>
                            {(s.statusBaru || 'lama') === 'baru' ? 'Baru' : 'Lama'}
                          </Badge>
                        </td>
                        <td>
                          <Badge className={(s.statusAktif ?? s.status_aktif) ? 'bg-success' : 'bg-danger'}>
                            <i className={`bi bi-${(s.statusAktif ?? s.status_aktif) ? 'check-circle' : 'x-circle'} me-1`}></i>
                            {(s.statusAktif ?? s.status_aktif) ? 'Aktif' : 'Tidak Aktif'}
                          </Badge>
                        </td>
                        <td className="text-muted">
                          {s.no_hp_ortu || <span className="text-muted">-</span>}
                        </td>
                        <td className="text-end pe-4">
                          <div className="btn-group-custom justify-content-end">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleShowQR(s)}
                              title="Lihat QR Code"
                            >
                              <i className="bi bi-qr-code"></i>
                            </Button>
                            <Button
                              variant="outline-warning"
                              size="sm"
                              onClick={() => handleShowModal(s)}
                              title="Edit"
                            >
                              <i className="bi bi-pencil-square"></i>
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDelete(s)}
                                title="Hapus"
                              >
                                <i className="bi bi-trash"></i>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="d-md-none p-2">
                {paginatedSantri.map((s) => (
                  <div key={s.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <div className="d-flex align-items-center">
                        <div className="avatar-circle me-2">
                          <i className="bi bi-person-circle text-primary"></i>
                        </div>
                        <div>
                          <strong className="d-block">{s.nama}</strong>
                          <small className="text-muted">NIS: {s.nis}</small>
                        </div>
                      </div>
                      <Badge className={(s.statusAktif ?? s.status_aktif) ? 'bg-success' : 'bg-danger'}>
                        {(s.statusAktif ?? s.status_aktif) ? 'Aktif' : 'Tidak Aktif'}
                      </Badge>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Kelas</span>
                        <span className="mobile-card-value">
                          <Badge bg="secondary">{s.kelas}</Badge>
                        </span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Status</span>
                        <span className="mobile-card-value">
                          <Badge className={(s.statusBaru || 'lama') === 'baru' ? 'bg-info' : 'bg-warning text-dark'}>
                            {(s.statusBaru || 'lama') === 'baru' ? 'Baru' : 'Lama'}
                          </Badge>
                        </span>
                      </div>
                      {s.no_hp_ortu && (
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">No HP Ortu</span>
                          <span className="mobile-card-value">{s.no_hp_ortu}</span>
                        </div>
                      )}
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleShowQR(s)}
                      >
                        <i className="bi bi-qr-code me-1"></i>
                        QR
                      </Button>
                      <Button
                        variant="outline-warning"
                        size="sm"
                        onClick={() => handleShowModal(s)}
                      >
                        <i className="bi bi-pencil-square me-1"></i>
                        Edit
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDelete(s)}
                        >
                          <i className="bi bi-trash me-1"></i>
                          Hapus
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Card className="border-0 mb-4 mt-3">
          <Card.Body className="d-flex justify-content-between align-items-center">
            <small className="text-muted">
              Menampilkan {startIndex + 1}-{Math.min(endIndex, totalItems)} dari {totalItems} santri
            </small>
            <div className="d-flex gap-2">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <i className="bi bi-chevron-left me-1"></i>
                Prev
              </Button>
              <span className="d-flex align-items-center px-2 small">
                Halaman {currentPage} dari {totalPages}
              </span>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <i className="bi bi-chevron-right ms-1"></i>
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Summary Info */}
      {!loading && filteredSantri.length > 0 && (
        <Row className="mt-4">
          <Col md={6}>
            <Card className="border-0 info-card">
              <Card.Body className="d-flex align-items-center">
                <div className="me-3">
                  <i className="bi bi-people-fill text-primary" style={{ fontSize: '2.5rem' }}></i>
                </div>
                <div>
                  <h4 className="mb-0 fw-bold">{filteredSantri.length}</h4>
                  <p className="mb-0 text-muted">
                    {searchTerm ? 'Santri ditemukan' : 'Total santri'}
                  </p>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="border-0 info-card">
              <Card.Body className="d-flex align-items-center">
                <div className="me-3">
                  <i className="bi bi-patch-check-fill text-success" style={{ fontSize: '2.5rem' }}></i>
                </div>
                <div>
                  <h4 className="mb-0 fw-bold">{filteredSantri.filter(s => s.statusAktif ?? s.status_aktif).length}</h4>
                  <p className="mb-0 text-muted">Santri aktif</p>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Modal Tambah/Edit Santri */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg" className="modal-custom" fullscreen="sm-down">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className={`bi bi-${editMode ? 'pencil-square' : bulkAddMode ? 'people-fill' : 'person-plus-fill'} me-2`}></i>
            {editMode ? 'Edit Santri' : bulkAddMode ? `Tambah ${bulkQuantity} Santri` : 'Tambah Santri Baru'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {/* Bulk Add Toggle */}
            {!editMode && (
              <Alert variant={bulkAddMode ? 'primary' : 'light'} className="mb-3">
                <Form.Check
                  type="switch"
                  id="bulk-add-switch"
                  label="Tambahkan beberapa santri sekaligus"
                  checked={bulkAddMode}
                  onChange={(e) => {
                    setBulkAddMode(e.target.checked);
                    if (e.target.checked) {
                      setBulkQuantity(2);
                    } else {
                      setBulkQuantity(1);
                    }
                  }}
                />
                <small className="text-muted d-block">NIS akan otomatis bertambah +1 dari NIS awal</small>
                {bulkAddMode && (
                  <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <Form.Label className="small fw-bold mb-1">
                      <i className="bi bi-123 me-1"></i>
                      Jumlah Santri
                    </Form.Label>
                    <div className="d-flex align-items-center gap-2">
                      <Button variant="outline-primary" size="sm" onClick={() => setBulkQuantity(Math.max(2, bulkQuantity - 1))}>
                        <i className="bi bi-dash"></i>
                      </Button>
                      <Form.Control
                        type="number"
                        value={bulkQuantity}
                        onChange={(e) => setBulkQuantity(Math.max(2, parseInt(e.target.value) || 2))}
                        min="2"
                        max="100"
                        className="text-center"
                        style={{ maxWidth: '80px' }}
                      />
                      <Button variant="outline-primary" size="sm" onClick={() => setBulkQuantity(Math.min(100, bulkQuantity + 1))}>
                        <i className="bi bi-plus"></i>
                      </Button>
                      <small className="text-muted">santri</small>
                    </div>
                  </div>
                )}
              </Alert>
            )}

            <Row>
              <Col sm={6}>
                <div className="form-group-custom">
                  <Form.Label>
                    <i className="bi bi-person me-1"></i>
                    Nama Lengkap
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.nama}
                    onChange={(e) => setFormData({...formData, nama: e.target.value})}
                    placeholder="Nama lengkap santri"
                    required
                  />
                </div>
              </Col>
              <Col sm={6}>
                <div className="form-group-custom">
                  <Form.Label>
                    <i className="bi bi-card-text me-1"></i>
                    NIS
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.nis}
                    onChange={(e) => setFormData({...formData, nis: e.target.value})}
                    placeholder="Masukkan NIS"
                    required
                    disabled={editMode}
                  />
                </div>
              </Col>
            </Row>
            <Row>
              <Col sm={6}>
                <div className="form-group-custom">
                  <Form.Label>
                    <i className="bi bi-mortarboard me-1"></i>
                    Kelas
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.kelas}
                    onChange={(e) => setFormData({...formData, kelas: e.target.value})}
                    placeholder="Contoh: XII IPA 1"
                    required
                  />
                </div>
              </Col>
              <Col sm={6}>
                <div className="form-group-custom">
                  <Form.Label>
                    <i className="bi bi-person-badge me-1"></i>
                    Status Santri
                  </Form.Label>
                  <Form.Select
                    value={formData.statusBaru}
                    onChange={(e) => setFormData({...formData, statusBaru: e.target.value})}
                  >
                    <option value="lama">Santri Lama</option>
                    <option value="baru">Santri Baru</option>
                  </Form.Select>
                </div>
              </Col>
            </Row>
            <Row>
              <Col sm={6}>
                <div className="form-group-custom">
                  <Form.Label>
                    <i className="bi bi-calendar-event me-1"></i>
                    Tanggal Lahir
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.tanggal_lahir}
                    onChange={(e) => setFormData({...formData, tanggal_lahir: e.target.value})}
                  />
                </div>
              </Col>
            </Row>
            <div className="form-group-custom">
              <Form.Label>
                <i className="bi bi-geo-alt me-1"></i>
                Alamat
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.alamat}
                onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                placeholder="Masukkan alamat lengkap"
              />
            </div>
            <div className="form-group-custom">
              <Form.Label>
                <i className="bi bi-phone me-1"></i>
                No HP Orang Tua
              </Form.Label>
              <Form.Control
                type="text"
                value={formData.no_hp_ortu}
                onChange={(e) => setFormData({...formData, no_hp_ortu: e.target.value})}
                placeholder="Contoh: 081234567890"
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={handleCloseModal} disabled={submitting}>
              <i className="bi bi-x-lg me-1"></i>
              Batal
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  {editMode ? 'Updating...' : bulkAddMode ? `Menyimpan ${bulkQuantity}...` : 'Menyimpan...'}
                </>
              ) : (
                <>
                  <i className={`bi bi-${editMode ? 'check-lg' : bulkAddMode ? 'people-fill' : 'save'} me-1`}></i>
                  {editMode ? 'Update' : bulkAddMode ? `Simpan ${bulkQuantity} Santri` : 'Simpan'}
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Import Excel */}
      <Modal show={showImportModal} onHide={() => { if (!importing) { setShowImportModal(false); setImportFile(null); setImportPreview([]); setFileData(null); } }} size="lg" className="modal-custom">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-file-earmark-excel text-success me-2"></i>
            Import Data Santri dari Excel
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Format Info */}
          <Alert variant="info" className="small">
            <strong>Format Kolom Excel:</strong><br />
            <code>STATUS</code>, <code>NIS</code>, <code>NAMA</code> (wajib), <code>KELAS</code> (opsional - bisa diedit nanti), <code>TANGGAL_LAHIR</code> (opsional), <code>ALAMAT</code> (opsional), <code>NO_HP_ORTU</code> (opsional)
          </Alert>

          {/* File Input */}
          <div className="mb-3">
            <Form.Label className="small fw-bold">Pilih File Excel (.xlsx, .xls)</Form.Label>
            <Form.Control
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              ref={fileInputRef}
              disabled={importing}
            />
          </div>

          {/* Preview Table */}
          {importPreview.length > 0 && (
            <div className="mt-3">
              <p className="small fw-bold mb-2">Preview (5 data pertama dari {fileData?.length || 0} total):</p>
              <div className="table-responsive" style={{ maxHeight: '200px', overflow: 'auto' }}>
                <Table striped bordered size="sm" className="small">
                  <thead className="table-light">
                    <tr>
                      <th>No</th>
                      <th>Status</th>
                      <th>NIS</th>
                      <th>Nama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, idx) => {
                      const nis = row.NIS || row.nis || row.Nis || row['__EMPTY'] || '-';
                      const nama = row.NAMA || row.nama || row.Nama || row['NAMA LENGKAP'] || row['__EMPTY_2'] || '-';
                      const rawStatus = (row.STATUS || row.status || row.Status || row['__EMPTY_1'] || '').trim().toLowerCase();
                      const displayStatus = (rawStatus && rawStatus !== '-' && rawStatus !== 'null') ? rawStatus : 'lama';
                      
                      return (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{displayStatus}</td>
                          <td>{nis}</td>
                          <td>{nama}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {importing && (
            <div className="mt-3">
              <p className="small fw-bold mb-1">
                Memproses... {importProgress.current} / {importProgress.total}
              </p>
              <div className="progress">
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setFileData(null); }}
            disabled={importing}
          >
            <i className="bi bi-x-lg me-1"></i>
            Batal
          </Button>
          <Button
            variant="success"
            onClick={handleImport}
            disabled={!fileData || importing}
          >
            {importing ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Importing...
              </>
            ) : (
              <>
                <i className="bi bi-upload me-1"></i>
                Import {fileData?.length || 0} Data
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal QR Code */}
      <Modal show={showQRModal} onHide={() => setShowQRModal(false)} size="sm" className="modal-custom">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-qr-code me-2"></i>
            QR Code Santri
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {selectedSantri ? (
            <>
              <div className="mb-3">
                <div className="avatar-circle mb-2">
                  <i className="bi bi-person-circle text-primary" style={{ fontSize: '3rem' }}></i>
                </div>
                <h5 className="mb-1 fw-bold">{selectedSantri.nama}</h5>
                <p className="text-muted mb-0">NIS: {selectedSantri.nis}</p>
              </div>
              <div className="qr-code-container my-3 d-flex justify-content-center" ref={qrRef}>
                <QRCodeCanvas
                  value={`SANTRI-${selectedSantri.nis}-${selectedSantri.id}`}
                  size={512}
                  level="M"
                  style={{ width: '200px', height: '200px' }}
                  includeMargin={true}
                  bgColor="white"
                  fgColor="#000000"
                />
              </div>
              <Alert variant="info" className="mb-0 small">
                <i className="bi bi-info-circle me-1"></i>
                Scan QR code ini untuk check in/out santri
              </Alert>
            </>
          ) : (
            <div className="py-4">
              <p className="text-muted mb-0">Pilih santri terlebih dahulu untuk melihat QR Code</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowQRModal(false)}>
            <i className="bi bi-x-lg me-1"></i>
            Tutup
          </Button>
          <Button
            variant="primary"
            onClick={handleDownloadQR}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Menyimpan...
              </>
            ) : (
              <>
                <i className="bi bi-download me-1"></i>
                Simpan QR Code
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default SantriManagement;
