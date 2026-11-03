import { strToU8, zipSync } from 'fflate';
import { describe as group, expect, it } from 'vitest';
import { exportMusicXML } from '../../src/io/musicxml/export';
import { importMusicXML, MusicXMLError } from '../../src/io/musicxml/import';
import { musicXMLText, readMxl } from '../../src/io/musicxml/mxl';
import { createWelcomeScore } from '../../src/model/demo';
import { addPart, setKeySignature, setTimeSignature } from '../../src/model/operations';
import { createScore } from '../../src/model/score';
import { fill, staffText, withoutIds } from '../helpers';

function parse(xml: string) {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

group('MusicXML export', () => {
  it('produces well-formed partwise MusicXML with header, attributes and parts', () => {
    let score = createWelcomeScore();
    score = addPart(score, 'violin');
    const xml = exportMusicXML(score);
    const doc = parse(xml);
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.localName).toBe('score-partwise');
    expect(doc.querySelector('work-title')?.textContent).toBe('Welcome to Clefhanger');
    expect(doc.querySelectorAll('score-part')).toHaveLength(2);
    expect(doc.querySelectorAll('part')).toHaveLength(2);
    const first = doc.querySelector('part measure attributes')!;
    expect(first.querySelector('staves')?.textContent).toBe('2');
    expect(first.querySelectorAll('clef')).toHaveLength(2);
    expect(doc.querySelector('sound')?.getAttribute('tempo')).toBe('96');
  });

  it('writes chords, alterations, dots and ties', () => {
    let score = fill(createScore({ instruments: ['flute'], measures: 2 }), 0, 0, 0, 'C4+E4:h. F#4:q~');
    score = fill(score, 0, 0, 1, 'F#4:q Bb4:h.');
    const doc = parse(exportMusicXML(score));
    const notes = Array.from(doc.querySelectorAll('note'));
    expect(notes[1].querySelector('chord')).not.toBeNull();
    expect(notes[0].querySelectorAll('dot')).toHaveLength(1);
    expect(notes[2].querySelector('alter')?.textContent).toBe('1');
    expect(notes[2].querySelector('tie')?.getAttribute('type')).toBe('start');
    expect(notes[3].querySelector('tie')?.getAttribute('type')).toBe('stop');
    expect(notes[4].querySelector('alter')?.textContent).toBe('-1');
  });

  it('escapes special characters in text', () => {
    const score = createScore({ title: 'Rock & Roll <live>', composer: '"Q"' });
    const xml = exportMusicXML(score);
    expect(xml).toContain('Rock &amp; Roll &lt;live&gt;');
    expect(parse(xml).querySelector('creator')?.textContent).toBe('"Q"');
  });
});

group('MusicXML round trip', () => {
  it('re-imports an exported score unchanged', () => {
    let score = createWelcomeScore();
    score = addPart(score, 'viola');
    score = fill(score, 1, 0, 2, 'C4:8 D4:16 E4:16 F4:q. G4:8 A4:q');
    score = setKeySignature(score, -2);
    const back = importMusicXML(exportMusicXML(score));
    expect(withoutIds({ ...back, id: '' })).toEqual(withoutIds({ ...score, id: '' }));
  });

  it('round-trips compound meters', () => {
    let score = fill(createScore({ instruments: ['cello'], measures: 3 }), 0, 0, 0, 'C3:q D3:q E3:h');
    score = setTimeSignature(score, { beats: 6, beatType: 8 });
    const back = importMusicXML(exportMusicXML(score));
    expect(back.timeSignature).toEqual({ beats: 6, beatType: 8 });
    expect(staffText(back)).toEqual(staffText(score));
  });
});

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <movement-title>Sample</movement-title>
  <identification><creator type="composer">Someone</creator></identification>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name><midi-instrument id="P1-I1"><midi-program>1</midi-program></midi-instrument></score-part>
    <score-part id="P2"><part-name>Violoncello</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <key><fifths>1</fifths><mode>major</mode></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>72</per-minute></metronome></direction-type></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
      <note><chord/><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>4</duration><tie type="start"/><voice>1</voice><type>half</type><staff>1</staff></note>
      <backup><duration>6</duration></backup>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>6</duration><voice>2</voice><type>half</type><dot/><staff>1</staff></note>
      <backup><duration>6</duration></backup>
      <note><rest measure="yes"/><duration>6</duration><voice>5</voice><staff>2</staff></note>
    </measure>
    <measure number="2">
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>1</duration><tie type="stop"/><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><grace/><pitch><step>A</step><octave>5</octave></pitch><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><rest/><duration>1</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <backup><duration>2</duration></backup>
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>3</duration><voice>5</voice><type>quarter</type><dot/><staff>2</staff></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>1</divisions><clef><sign>F</sign><line>4</line></clef></attributes>
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>3</duration><voice>1</voice><type>half</type><dot/></note>
    </measure>
  </part>
</score-partwise>`;

group('MusicXML import', () => {
  const score = importMusicXML(SAMPLE);

  it('reads metadata, key, time and tempo', () => {
    expect(score.title).toBe('Sample');
    expect(score.composer).toBe('Someone');
    expect(score.keySignature).toEqual({ fifths: 1 });
    expect(score.timeSignature).toEqual({ beats: 3, beatType: 4 });
    expect(score.tempo).toBe(72);
  });

  it('maps parts, staves, clefs and instruments', () => {
    expect(score.parts.map((p) => p.name)).toEqual(['Piano', 'Violoncello']);
    expect(score.parts.map((p) => p.instrument)).toEqual(['piano', 'cello']);
    expect(score.parts[0].staves.map((s) => s.clef)).toEqual(['treble', 'bass']);
    expect(score.parts[1].staves.map((s) => s.clef)).toEqual(['bass']);
  });

  it('imports chords and ties, keeps the first voice per staff and skips grace notes', () => {
    expect(staffText(score, 0, 0)).toEqual(['G4+B4:q F♯5:h~', 'F♯5:8 r:8 r:q r:q']);
  });

  it('expands whole-measure rests and pads short measures', () => {
    expect(staffText(score, 0, 1)).toEqual(['r:h.', 'G2:q. r:8 r:q']);
    expect(staffText(score, 1, 0)).toEqual(['G2:h.', 'r:h.']);
  });

  it('rejects files that are not MusicXML', () => {
    expect(() => importMusicXML('<html></html>')).toThrow(MusicXMLError);
    expect(() => importMusicXML('not xml at all <')).toThrow(MusicXMLError);
  });
});

group('compressed MusicXML (.mxl)', () => {
  it('finds the root file through META-INF/container.xml', () => {
    const zip = zipSync({
      'META-INF/container.xml': strToU8(
        '<container><rootfiles><rootfile full-path="scores/main.musicxml"/></rootfiles></container>',
      ),
      'scores/main.musicxml': strToU8(SAMPLE),
    });
    expect(readMxl(zip)).toBe(SAMPLE);
    expect(musicXMLText(zip.buffer as ArrayBuffer)).toBe(SAMPLE);
  });

  it('passes plain XML through', () => {
    expect(musicXMLText(strToU8(SAMPLE).buffer as ArrayBuffer)).toBe(SAMPLE);
  });
});
