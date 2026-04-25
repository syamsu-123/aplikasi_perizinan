const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/SantriManagement.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = '  const handleFileSelect = (e) => {';
const endMarker = '\n  const handleImport = async () => {';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find markers. Start:', startIndex, 'End:', endIndex);
  process.exit(1);
}

const newFunction = `  const handleFileSelect = (e) => {
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
          
          // Detect format: SMK PSAS has 'DATA SISWA SMK AL-ITTIHAD' column
          const firstRow = rawData[0];
          const isSMKPSASFormat = firstRow['DATA SISWA SMK AL-ITTIHAD'] !== undefined;
          
          let sheetData = [];
          
          if (isSMKPSASFormat) {
            // SMK PSAS format: smart detection
            let currentKelas = sheetName;
            
            for (let i = 0; i < rawData.length; i++) {
              const row = rawData[i];
              const cell0 = row['DATA SISWA SMK AL-ITTIHAD'];
              
              // Detect kelas header (e.g., 'Kelas X A SMK', 'Kelas XI', 'Kelas XII')
              if (typeof cell0 === 'string' && cell0.startsWith('Kelas')) {
                currentKelas = cell0.replace('Kelas ', '').trim();
                continue;
              }
              
              // Skip header rows
              if (cell0 === 'NO.' || cell0 === 'TAHUN PELAJARAN 2025/2026' || cell0 === undefined) {
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
`;

content = content.substring(0, startIndex) + newFunction + content.substring(endIndex);

fs.writeFileSync(filePath, content);
console.log('Successfully updated handleFileSelect with auto-detection!');
