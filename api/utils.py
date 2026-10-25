def attendance_insight(attended, total, required=75):
    """Percentage + how many classes can be skipped / must be attended."""
    pct = round(attended * 100 / total, 1) if total else 0.0
    skippable, needed = 0, 0
    if total == 0:
        message = 'No classes marked yet'
    elif pct >= required:
        skippable = (attended * 100) // required - total
        message = f'You can skip {skippable} more class(es)' if skippable > 0 else 'Do not skip the next class'
    elif required >= 100:
        needed, message = None, 'Cannot recover to 100%'
    else:
        n = required * total - 100 * attended
        needed = -(-n // (100 - required))
        message = f'Attend the next {needed} class(es) to reach {required}%'
    return {'percentage': pct, 'skippable': max(skippable, 0), 'needed': needed, 'message': message}