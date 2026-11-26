<?php
declare(strict_types=1);

/**
 * Konverter & Parser Naskah StoryPad (PHP Native).
 * Mendukung ekstraksi dokumen Word (.docx), Fountain (.fountain), Markdown (.md), dan Teks (.txt)
 * menjadi struktur proyek multi-scene (projects + script_lines) siap produksi.
 */
class ScriptParser
{
    /**
     * Ekstrak blok paragraf bertanda gaya dari berkas .docx (Word OpenXML).
     * Menggunakan ZipArchive bila tersedia, atau pembaca ZIP biner murni sebagai fallback.
     *
     * @return array<int, array{text:string, style:string}>
     */
    private const MAX_XML_BYTES = 5242880; // 5 MB

    public static function extractDocxBlocks(string $filePath): array
    {
        $xmlString = self::readZipEntry($filePath, 'word/document.xml');
        if ($xmlString === null || $xmlString === '') {
            throw new RuntimeException('Tidak dapat membaca isi word/document.xml dari berkas .docx.');
        }

        if (preg_match('/<!(?:DOCTYPE|ENTITY)\b/i', $xmlString) === 1) {
            throw new RuntimeException('Konten XML .docx mengandung deklarasi DOCTYPE/ENTITY yang ditolak.');
        }

        $prevUseErrors = libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        $loaded = $dom->loadXML($xmlString, LIBXML_NONET | LIBXML_NOCDATA);
        libxml_clear_errors();
        libxml_use_internal_errors($prevUseErrors);

        if (!$loaded) {
            throw new RuntimeException('Struktur XML dokumen .docx tidak valid.');
        }

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');

        $blocks = [];
        $bodyNodes = $xpath->query('//w:body/*');
        if ($bodyNodes === false) {
            return [];
        }

        foreach ($bodyNodes as $node) {
            if ($node->localName === 'p') {
                $style = '';
                $styleAttr = $xpath->query('w:pPr/w:pStyle/@w:val', $node);
                if ($styleAttr !== false && $styleAttr->length > 0) {
                    $style = (string) $styleAttr->item(0)->nodeValue;
                }
                $text = self::collectParagraphText($xpath, $node);
                $blocks[] = ['text' => $text, 'style' => $style];
            } elseif ($node->localName === 'tbl') {
                $rows = $xpath->query('w:tr', $node);
                if ($rows !== false) {
                    foreach ($rows as $tr) {
                        $cells = [];
                        $tcNodes = $xpath->query('w:tc', $tr);
                        if ($tcNodes !== false) {
                            foreach ($tcNodes as $tc) {
                                $cellTxt = trim(self::collectParagraphText($xpath, $tc));
                                if ($cellTxt !== '') {
                                    $cells[] = $cellTxt;
                                }
                            }
                        }
                        if (count($cells) === 2 && preg_match('/^[A-Z0-9\s\/._-]{2,28}$/u', $cells[0])) {
                            $blocks[] = ['text' => strtoupper($cells[0]), 'style' => 'Heading3'];
                            $blocks[] = ['text' => $cells[1], 'style' => ''];
                        } elseif (count($cells) > 0) {
                            $blocks[] = ['text' => implode(' | ', $cells), 'style' => ''];
                        }
                    }
                }
            }
        }

        return $blocks;
    }

    private static function collectParagraphText(DOMXPath $xpath, DOMNode $context): string
    {
        $parts = [];
        $leaves = $xpath->query('.//w:t | .//w:tab | .//w:br', $context);
        if ($leaves !== false) {
            foreach ($leaves as $leaf) {
                if ($leaf->localName === 't') {
                    $parts[] = $leaf->textContent;
                } elseif ($leaf->localName === 'tab') {
                    $parts[] = ' ';
                } elseif ($leaf->localName === 'br') {
                    $parts[] = "\n";
                }
            }
        }
        return trim(implode('', $parts));
    }

    private static function readZipEntry(string $zipFile, string $entryName): ?string
    {
        if (class_exists('ZipArchive')) {
            $zip = new ZipArchive();
            if ($zip->open($zipFile) === true) {
                $stat = $zip->statName($entryName);
                if (is_array($stat) && isset($stat['size']) && (int) $stat['size'] > self::MAX_XML_BYTES) {
                    $zip->close();
                    throw new RuntimeException('Ukuran XML naskah .docx melebihi batas maksimum 5 MB.');
                }
                $content = $zip->getFromName($entryName);
                $zip->close();
                if (is_string($content)) {
                    if (strlen($content) > self::MAX_XML_BYTES) {
                        throw new RuntimeException('Ukuran XML naskah .docx melebihi batas maksimum 5 MB.');
                    }
                    return $content;
                }
            }
        }

        $raw = @file_get_contents($zipFile);
        if ($raw === false) {
            return null;
        }

        // Cari End of Central Directory (PK\x05\x06)
        $eocdPos = strrpos($raw, "PK\x05\x06");
        if ($eocdPos === false || strlen($raw) < $eocdPos + 22) {
            return null;
        }

        $eocd = unpack('vdisk/vstartDisk/ventriesDisk/ventriesTotal/VcdSize/VcdOffset', substr($raw, $eocdPos + 4, 16));
        if (!is_array($eocd)) {
            return null;
        }

        $pos = (int) $eocd['cdOffset'];
        $total = (int) $eocd['entriesTotal'];
        $len = strlen($raw);

        for ($i = 0; $i < $total && $pos + 46 <= $len; $i++) {
            if (substr($raw, $pos, 4) !== "PK\x01\x02") {
                break;
            }
            $hdr = unpack('vverMade/vverNeed/vflag/vmethod/vmodTime/vmodDate/Vcrc/VcompSize/VuncompSize/vnameLen/vextraLen/vcommentLen/vdiskStart/vintAttr/VextAttr/VlocalOffset', substr($raw, $pos + 4, 42));
            if (!is_array($hdr)) {
                break;
            }
            $name = substr($raw, $pos + 46, (int) $hdr['nameLen']);
            $pos += 46 + (int) $hdr['nameLen'] + (int) $hdr['extraLen'] + (int) $hdr['commentLen'];

            if ($name === $entryName) {
                $localPos = (int) $hdr['localOffset'];
                if ($localPos + 30 > $len || substr($raw, $localPos, 4) !== "PK\x03\x04") {
                    return null;
                }
                $lhdr = unpack('vverNeed/vflag/vmethod/vmodTime/vmodDate/Vcrc/VcompSize/VuncompSize/vnameLen/vextraLen', substr($raw, $localPos + 4, 26));
                if ((int) $hdr['uncompSize'] > self::MAX_XML_BYTES || (int) $lhdr['uncompSize'] > self::MAX_XML_BYTES) {
                    throw new RuntimeException('Ukuran XML naskah .docx melebihi batas maksimum 5 MB.');
                }
                $dataStart = $localPos + 30 + (int) $lhdr['nameLen'] + (int) $lhdr['extraLen'];
                $compData = substr($raw, $dataStart, (int) $hdr['compSize']);
                if ((int) $hdr['method'] === 0) {
                    return strlen($compData) <= self::MAX_XML_BYTES ? $compData : null;
                }
                if ((int) $hdr['method'] === 8) {
                    $inflated = @gzinflate($compData, self::MAX_XML_BYTES + 1);
                    if ($inflated === false || strlen($inflated) > self::MAX_XML_BYTES) {
                        return null;
                    }
                    return $inflated;
                }
                return null;
            }
        }

        return null;
    }

    /**
     * Normalisasi teks dari karakter em dash, en dash, dan kutip miring agar rapi & konsisten NLE (R-02).
     */
    public static function normalizeText(string $input): string
    {
        $replacements = [
            "\xE2\x80\x94" => ' - ', // U+2014 em dash
            "\xE2\x80\x93" => ' - ', // U+2013 en dash
            "\xE2\x80\x9C" => '"',   // U+201C left quote
            "\xE2\x80\x9D" => '"',   // U+201D right quote
            "\xE2\x80\x98" => "'",   // U+2018 left single quote
            "\xE2\x80\x99" => "'",   // U+2019 right single quote
            "\xE2\x80\xA6" => '...', // U+2026 ellipsis
            "\xC2\xB1"     => '+-',  // U+00B1 plus-minus
            "\xE2\x80\xA2" => ',',   // U+2022 bullet
            "\xE2\x86\x92" => '->',  // U+2192 arrow
        ];
        $clean = strtr($input, $replacements);
        $clean = preg_replace('/[ \t]+/', ' ', $clean) ?? $clean;
        $clean = preg_replace('/\s+-\s+/', ' - ', $clean) ?? $clean;
        return trim($clean);
    }

    /**
     * Ubah blok paragraf (dari .docx atau teks biasa) menjadi struktur proyek + script_lines.
     *
     * @param array<int, array{text:string, style?:string}> $blocks
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    public static function parseBlocks(array $blocks, array $overrides = []): array
    {
        $detectedTitle = '';
        $detectedCategory = '';
        $detectedLocation = '';
        $detectedDuration = '';
        $detectedSynopsis = '';

        $currentSceneNum = '01';
        $currentSceneTitle = 'SCENE 01';
        $currentSceneDuration = '';
        $shotCounterInScene = 1;
        $hasStartedScenes = false;

        $lines = [];
        $pendingCharacter = null;
        $lastLineIndex = -1;

        $count = count($blocks);
        for ($i = 0; $i < $count; $i++) {
            $rawText = (string) ($blocks[$i]['text'] ?? '');
            $style = strtolower((string) ($blocks[$i]['style'] ?? ''));
            $text = self::normalizeText($rawText);

            if ($text === '') {
                $pendingCharacter = null;
                continue;
            }

            // Abaikan penanda akhir naskah seperti TITLE CARD judul berulang di bagian paling bawah
            if ($hasStartedScenes && ($style === 'heading1' || strcasecmp($text, 'TITLE CARD') === 0)) {
                $lines[] = [
                    'type' => 'action',
                    'scene_number' => $currentSceneNum,
                    'scene_title' => $currentSceneTitle,
                    'content' => 'TITLE CARD: ' . $text,
                ];
                continue;
            }

            // 1. Deteksi Judul Utama (Heading 1 atau baris pertama sebelum SCENE)
            if (!$hasStartedScenes && $detectedTitle === '' && ($style === 'heading1' || $style === 'title' || $i === 0)) {
                if (!self::isSceneHeading($text, $style)) {
                    $detectedTitle = trim($text, "#* \t\n\r");
                    continue;
                }
            }

            // 2. Deteksi Metadata Header sebelum Scene 1 (Genre, Durasi, Lokasi, Konsep/Sinopsis)
            if (!$hasStartedScenes && !self::isSceneHeading($text, $style)) {
                foreach (preg_split('/\r?\n/', $text) ?: [$text] as $metaLine) {
                    $metaLine = trim($metaLine);
                    if ($metaLine === '') {
                        continue;
                    }
                    if (stripos($metaLine, 'genre:') !== false || stripos($metaLine, 'lokasi:') !== false || stripos($metaLine, 'durasi:') !== false) {
                        foreach (explode('|', $metaLine) as $part) {
                            $part = trim($part);
                            if (stripos($part, 'genre:') === 0) {
                                $detectedCategory = trim(substr($part, 6));
                            } elseif (stripos($part, 'lokasi:') === 0) {
                                $detectedLocation = trim(substr($part, 7));
                            } elseif (stripos($part, 'durasi:') === 0) {
                                $detectedDuration = trim(substr($part, 7));
                            }
                        }
                    } elseif (stripos($metaLine, 'konsep:') === 0 || stripos($metaLine, 'sinopsis:') === 0 || stripos($metaLine, 'logline:') === 0) {
                        $colonPos = strpos($metaLine, ':');
                        $detectedSynopsis = $colonPos !== false ? trim(substr($metaLine, $colonPos + 1)) : $metaLine;
                    } elseif ($detectedSynopsis === '') {
                        $detectedSynopsis = $metaLine;
                    }
                }
                continue;
            }

            // 3. Deteksi Scene Heading / Slugline
            if (self::isSceneHeading($text, $style)) {
                $hasStartedScenes = true;
                $pendingCharacter = null;
                $shotCounterInScene = 1;
                $currentSceneDuration = '';

                if (preg_match('/^(?:SCENE|ADEGAN|BABAK)\s*0*(\d+)\s*(?:[-:.]\s*(.*))?$/iu', $text, $m)) {
                    $numInt = max(1, (int) $m[1]);
                    $currentSceneNum = str_pad((string) $numInt, 2, '0', STR_PAD_LEFT);
                    $rest = isset($m[2]) && trim($m[2]) !== '' ? strtoupper(trim($m[2])) : '';
                    $currentSceneTitle = 'SCENE ' . $currentSceneNum . ($rest !== '' ? ' - ' . $rest : '');
                } else {
                    $nextNum = $hasStartedScenes && !empty($lines) ? ((int) $currentSceneNum + 1) : 1;
                    $currentSceneNum = str_pad((string) $nextNum, 2, '0', STR_PAD_LEFT);
                    $cleanSlug = ltrim($text, '.# ');
                    $currentSceneTitle = 'SCENE ' . $currentSceneNum . ' - ' . strtoupper($cleanSlug);
                }
                continue;
            }

            $hasStartedScenes = true;

            // 4. Deteksi keterangan Durasi tepat di bawah judul Scene
            if (preg_match('/^Durasi\s*:\s*(.+)$/iu', $text, $dm)) {
                $currentSceneDuration = trim($dm[1]);
                if (strpos($currentSceneTitle, '(') === false && $currentSceneDuration !== '') {
                    $currentSceneTitle .= ' (' . $currentSceneDuration . ')';
                    // Perbarui baris di scene yang sama jika sudah ada
                    foreach ($lines as &$existingLine) {
                        if ($existingLine['scene_number'] === $currentSceneNum) {
                            $existingLine['scene_title'] = $currentSceneTitle;
                        }
                    }
                    unset($existingLine);
                }
                $lines[] = [
                    'type' => 'action',
                    'scene_number' => $currentSceneNum,
                    'scene_title' => $currentSceneTitle,
                    'content' => 'Durasi: ' . $currentSceneDuration,
                ];
                $lastLineIndex = count($lines) - 1;
                continue;
            }

            // 5. Deteksi format inline "KARAKTER: Dialog teks"
            if ($pendingCharacter === null && self::isInlineDialogue($text, $charOut, $dlgOut)) {
                $shotStr = str_pad((string) $shotCounterInScene, 2, '0', STR_PAD_LEFT);
                $shotCounterInScene++;
                $lines[] = [
                    'type' => 'dialogue',
                    'scene_number' => $currentSceneNum,
                    'scene_title' => $currentSceneTitle,
                    'character' => strtoupper($charOut),
                    'text' => self::stripOuterQuotes($dlgOut),
                    'parenthetical' => '',
                    'shot' => $shotStr,
                    'timecode' => self::estimateTimecode($currentSceneDuration, $shotCounterInScene - 1),
                    'keyword' => self::buildKeyword($dlgOut, $charOut),
                ];
                $lastLineIndex = count($lines) - 1;
                continue;
            }

            // 6. Deteksi Nama Karakter (Heading 3 di Word atau baris huruf kapital pendek diikuti dialog)
            $nextBlockText = ($i + 1 < $count) ? self::normalizeText((string) ($blocks[$i + 1]['text'] ?? '')) : '';
            $nextBlockStyle = ($i + 1 < $count) ? strtolower((string) ($blocks[$i + 1]['style'] ?? '')) : '';
            if ($pendingCharacter === null && self::isCharacterCue($text, $style, $nextBlockText, $nextBlockStyle)) {
                $pendingCharacter = strtoupper(trim($text, ': '));
                continue;
            }

            // 7. Jika sedang menunggu baris dialog untuk $pendingCharacter
            if ($pendingCharacter !== null) {
                $parenthetical = '';
                $dialogueText = $text;

                // Bila baris pertama setelah karakter adalah parenthetical (mis. "(Sambil berbisik)") dan baris berikutnya dialog
                if (self::isParentheticalLine($text) && $nextBlockText !== '' && !self::isSceneHeading($nextBlockText, $nextBlockStyle) && $nextBlockStyle !== 'heading3') {
                    $parenthetical = trim($text, '() ');
                    $dialogueText = $nextBlockText;
                    $i++;
                }

                $shotStr = str_pad((string) $shotCounterInScene, 2, '0', STR_PAD_LEFT);
                $shotCounterInScene++;

                $lines[] = [
                    'type' => 'dialogue',
                    'scene_number' => $currentSceneNum,
                    'scene_title' => $currentSceneTitle,
                    'character' => $pendingCharacter,
                    'text' => self::stripOuterQuotes($dialogueText),
                    'parenthetical' => $parenthetical,
                    'shot' => $shotStr,
                    'timecode' => self::estimateTimecode($currentSceneDuration, $shotCounterInScene - 1),
                    'keyword' => self::buildKeyword($dialogueText, $pendingCharacter),
                ];
                $lastLineIndex = count($lines) - 1;
                $pendingCharacter = null;
                continue;
            }

            // 8. Deteksi Parenthetical tepat setelah baris dialog (seperti "(Emosi: ... | Gesture: ...)")
            if (self::isParentheticalLine($text) && $lastLineIndex >= 0 && $lines[$lastLineIndex]['type'] === 'dialogue') {
                $cleanParen = trim($text, '() ');
                $existingParen = $lines[$lastLineIndex]['parenthetical'];
                $lines[$lastLineIndex]['parenthetical'] = $existingParen !== ''
                    ? ($existingParen . ' | ' . $cleanParen)
                    : $cleanParen;
                continue;
            }

            // 9. Selain itu adalah baris Action / Shot Direction
            $lines[] = [
                'type' => 'action',
                'scene_number' => $currentSceneNum,
                'scene_title' => $currentSceneTitle,
                'content' => $text,
            ];
            $lastLineIndex = count($lines) - 1;
        }

        // Bangun metadata proyek utuh
        $title = trim((string) ($overrides['title'] ?? ''));
        if ($title === '') {
            $title = $detectedTitle !== '' ? $detectedTitle : 'Naskah Baru';
        }

        $slugBase = strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $title));
        $slugBase = trim($slugBase, '-');
        if ($slugBase === '') {
            $slugBase = 'naskah';
        }

        $projectId = trim((string) ($overrides['id'] ?? ''));
        if ($projectId === '') {
            $projectId = 'proj-' . substr($slugBase, 0, 20) . '-' . substr((string) time(), -4);
        }

        $code = trim((string) ($overrides['code'] ?? ''));
        if ($code === '') {
            $prefix = strtoupper(substr((string) preg_replace('/[^a-z0-9]+/i', '', $title), 0, 4));
            $code = ($prefix !== '' ? $prefix : 'SCRP') . '-01';
        }

        $category = trim((string) ($overrides['category'] ?? ''));
        if ($category === '') {
            $category = $detectedCategory !== '' ? $detectedCategory : 'Film Pendek';
        }

        $fps = trim((string) ($overrides['fps'] ?? '24 fps')) ?: '24 fps';
        $day = trim((string) ($overrides['day'] ?? 'Day 01')) ?: 'Day 01';
        $draft = trim((string) ($overrides['draft'] ?? 'Draft v1.0')) ?: 'Draft v1.0';
        $location = trim((string) ($overrides['location'] ?? $detectedLocation));
        $durationTarget = trim((string) ($overrides['duration_target'] ?? $detectedDuration));
        $synopsis = trim((string) ($overrides['synopsis'] ?? $detectedSynopsis));
        $sourceFilename = trim((string) ($overrides['source_filename'] ?? ''));

        // Hitung daftar scene unik
        $scenesMap = [];
        foreach ($lines as $ln) {
            $sn = $ln['scene_number'];
            if (!isset($scenesMap[$sn])) {
                $scenesMap[$sn] = $ln['scene_title'];
            }
        }
        if (empty($scenesMap)) {
            $scenesMap['01'] = 'SCENE 01';
        }

        $firstSceneNum = (string) array_key_first($scenesMap);
        $firstSceneTitle = (string) $scenesMap[$firstSceneNum];
        $sceneCount = count($scenesMap);

        $subtitleParts = array_filter([$category, $location, $durationTarget]);
        $subtitle = !empty($subtitleParts) ? implode(' | ', $subtitleParts) : $title;

        $dbLines = [];
        $charactersSet = [];
        $dialogueCount = 0;
        $actionIdx = 1;
        $dlgIdx = 1;
        $sortOrder = 10;

        foreach ($lines as $ln) {
            $sn = $ln['scene_number'];
            if ($ln['type'] === 'action') {
                $lineId = $slugBase . '-s' . $sn . '-a' . str_pad((string) $actionIdx, 2, '0', STR_PAD_LEFT);
                $actionIdx++;
                $dbLines[] = [
                    'id' => $lineId,
                    'project_id' => $projectId,
                    'line_type' => 'action',
                    'sort_order' => $sortOrder,
                    'scene_number' => $sn,
                    'scene_title' => $ln['scene_title'],
                    'content' => $ln['content'],
                    'character_name' => null,
                    'timecode' => null,
                    'dialogue_text' => null,
                    'parenthetical' => '',
                    'keyword' => null,
                    'shot' => null,
                    'status' => null,
                    'status_label' => null,
                    'continuity_note' => '',
                    'is_archived' => false,
                ];
            } else {
                $lineId = $slugBase . '-s' . $sn . '-d' . str_pad((string) $dlgIdx, 2, '0', STR_PAD_LEFT);
                $dlgIdx++;
                $dialogueCount++;
                $charactersSet[$ln['character']] = true;
                $dbLines[] = [
                    'id' => $lineId,
                    'project_id' => $projectId,
                    'line_type' => 'dialogue',
                    'sort_order' => $sortOrder,
                    'scene_number' => $sn,
                    'scene_title' => $ln['scene_title'],
                    'content' => null,
                    'character_name' => $ln['character'],
                    'timecode' => $ln['timecode'],
                    'dialogue_text' => $ln['text'],
                    'parenthetical' => $ln['parenthetical'],
                    'keyword' => $ln['keyword'],
                    'shot' => $ln['shot'],
                    'status' => 'pending',
                    'status_label' => 'Pending Shoot',
                    'continuity_note' => '',
                    'is_archived' => false,
                ];
            }
            $sortOrder += 10;
        }

        $projectRow = [
            'id' => $projectId,
            'code' => strtoupper($code),
            'title' => $title,
            'category' => $category,
            'subtitle' => $subtitle,
            'synopsis' => $synopsis,
            'location' => $location,
            'duration_target' => $durationTarget,
            'source_filename' => $sourceFilename,
            'tag' => $sceneCount . ' Scene',
            'day' => $day,
            'takes_logged' => 0,
            'fps' => $fps,
            'good_take_percentage' => 0,
            'review_percentage' => 0,
            'sync_status' => 'Ready',
            'draft' => $draft,
            'scene_number' => $firstSceneNum,
            'shot_number' => '01',
            'slug_number' => 'SCENE ' . $firstSceneNum,
            'scene_title' => $firstSceneTitle,
            'scene_timecode' => '00:00:00:00',
            'take_info' => '0 TAKE',
            'sort_order' => (int) ($overrides['sort_order'] ?? 10),
            'is_archived' => false,
        ];

        return [
            'project' => $projectRow,
            'lines' => $dbLines,
            'summary' => [
                'scene_count' => $sceneCount,
                'scenes' => $scenesMap,
                'line_count' => count($dbLines),
                'dialogue_count' => $dialogueCount,
                'action_count' => count($dbLines) - $dialogueCount,
                'characters' => array_keys($charactersSet),
            ],
        ];
    }

    /**
     * Parse teks mentah (.txt, .fountain, .md, atau hasil tempel textarea).
     *
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    public static function parseRawText(string $rawText, array $overrides = []): array
    {
        $rawLines = preg_split('/\r?\n/', $rawText) ?: [];
        $blocks = [];
        foreach ($rawLines as $line) {
            $trimmed = trim($line);
            $style = '';
            if (preg_match('/^#\s+(.+)$/', $trimmed, $m)) {
                $style = 'Heading1';
                $trimmed = $m[1];
            } elseif (preg_match('/^##\s+(.+)$/', $trimmed, $m)) {
                $style = 'Heading2';
                $trimmed = $m[1];
            } elseif (preg_match('/^###\s+(.+)$/', $trimmed, $m)) {
                $style = 'Heading3';
                $trimmed = $m[1];
            }
            $blocks[] = ['text' => $trimmed, 'style' => $style];
        }
        return self::parseBlocks($blocks, $overrides);
    }

    private static function isSceneHeading(string $text, string $style): bool
    {
        if (preg_match('/^(?:SCENE|ADEGAN|BABAK)\s+\d+/iu', $text)) {
            return true;
        }
        if (preg_match('/^(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+/iu', $text)) {
            return true;
        }
        if ($style === 'heading2' && (stripos($text, 'scene') !== false || stripos($text, 'int.') !== false || stripos($text, 'ext.') !== false)) {
            return true;
        }
        if (str_starts_with($text, '.') && strlen($text) > 2 && !str_starts_with($text, '..')) {
            return true; // Konvensi Fountain .SLUGLINE
        }
        return false;
    }

    private static function isInlineDialogue(string $text, ?string &$charOut, ?string &$dlgOut): bool
    {
        $charOut = null;
        $dlgOut = null;
        if (str_starts_with($text, '[') || str_starts_with($text, '(')) {
            return false;
        }
        $nonCharacterLabels = ['SHOT', 'CUT', 'BEAT', 'DURASI', 'GENRE', 'KONSEP', 'LOKASI', 'SINOPSIS', 'LOGLINE', 'SCENE', 'ADEGAN', 'CATATAN', 'NOTE', 'TITLE CARD'];
        if (preg_match('/^([A-Z][A-Z0-9\s\/._-]{1,26})\s*:\s*(.+)$/u', $text, $m)) {
            $candidate = strtoupper(trim($m[1]));
            if (in_array($candidate, $nonCharacterLabels, true)) {
                return false;
            }
            $charOut = $candidate;
            $dlgOut = trim($m[2]);
            return $dlgOut !== '';
        }
        return false;
    }

    private static function isCharacterCue(string $text, string $style, string $nextText, string $nextStyle): bool
    {
        if ($style === 'heading3') {
            return trim($text) !== '';
        }
        if ($nextText === '' || $nextStyle === 'heading2' || $nextStyle === 'heading3') {
            return false;
        }
        if (str_starts_with($text, '[') || str_starts_with($text, '(') || strlen($text) > 32) {
            return false;
        }
        if (preg_match('/[.!?]$/', $text)) {
            return false;
        }
        $nonCues = ['TITLE CARD', 'CUT TO BLACK', 'FADE IN', 'FADE OUT', 'END', 'TAMAT', 'SEMUA DIAM'];
        $upper = mb_strtoupper($text, 'UTF-8');
        if (in_array($upper, $nonCues, true)) {
            return false;
        }
        // Harus seluruhnya huruf kapital (mengizinkan angka, spasi, garis miring, tanda kurung V.O./O.S.)
        return $text === $upper && (bool) preg_match('/^[A-Z][A-Z0-9\s\/()._-]*$/u', $text);
    }

    private static function isParentheticalLine(string $text): bool
    {
        return str_starts_with($text, '(') && str_ends_with($text, ')');
    }

    private static function stripOuterQuotes(string $text): string
    {
        $t = trim($text);
        if (strlen($t) >= 2 && (($t[0] === '"' && substr($t, -1) === '"') || ($t[0] === "'" && substr($t, -1) === "'"))) {
            return trim(substr($t, 1, -1));
        }
        return $t;
    }

    private static function estimateTimecode(string $sceneDuration, int $shotIndex): string
    {
        $baseSec = 0;
        if (preg_match('/(\d{1,2}):(\d{2})/', $sceneDuration, $m)) {
            $baseSec = ((int) $m[1] * 60) + (int) $m[2];
        }
        $sec = $baseSec + max(0, ($shotIndex - 1) * 2);
        $hrs = intdiv($sec, 3600);
        $mins = intdiv($sec % 3600, 60);
        $secs = $sec % 60;
        return sprintf('%02d:%02d:%02d', $hrs, $mins, $secs);
    }

    public static function buildKeyword(string $dialogueText, string $character): string
    {
        $clean = preg_replace('/[^a-zA-Z0-9\s]/u', ' ', $dialogueText) ?? '';
        $words = array_values(array_filter(preg_split('/\s+/', trim($clean)) ?: []));
        if (empty($words)) {
            $charWords = array_values(array_filter(preg_split('/\s+/', preg_replace('/[^a-zA-Z0-9\s]/u', ' ', $character) ?? '') ?: []));
            $words = !empty($charWords) ? array_merge($charWords, ['Cue']) : ['DialogCue'];
        }
        $picked = array_slice($words, 0, 3);
        $camel = implode('', array_map(static fn(string $w): string => ucfirst(strtolower($w)), $picked));
        return substr($camel !== '' ? $camel : 'DialogCue', 0, 24);
    }
}
