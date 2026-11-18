"""Verified timing markers for the Sobu Rapid Line door announcement."""

def mark(a, b, lang, text, ref_start, ref_end):
    return {'start': a, 'end': b, 'lang': lang, 'field': 'door', 'text': text,
            'ref_start': ref_start, 'ref_end': ref_end}


JR_JA = 'お出口は右側です'
JR_EN = 'The doors on the right side will open'
MARKERS = {
    'cae9e0662bf94ae41a5da3c2c1e50892': [
        mark(4.64, 7.08, 'JA', JR_JA, 0.8, 7.6),
        mark(33.58, 35.90, 'EN', JR_EN, 28.3, 35.7),
    ],
}
