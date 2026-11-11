// Sidebar panels: ghost proximity meter, inventory vs ritual requirements, stream log.
import 'package:flutter/material.dart';

import '../../models/db.dart';
import '../../state/game_engine.dart';
import '../theme.dart';

class GhostMeter extends StatelessWidget {
  const GhostMeter({super.key, required this.proximity, required this.ghost, required this.chasing});
  final double proximity;
  final PlaceGhost? ghost;
  final bool chasing;

  @override
  Widget build(BuildContext context) {
    const segments = 20;
    final lit = (proximity / 100 * segments).round();
    final status = chasing
        ? 'HUNTING YOU'
        : proximity > 70
            ? 'RIGHT BEHIND YOU'
            : proximity > 40
                ? 'CLOSE'
                : proximity > 15
                    ? 'NEARBY'
                    : 'QUIET';
    final showName = ghost != null && (chasing || proximity > 40);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text('EMF · GHOST PROXIMITY', style: label())),
        Text('${proximity.round()}%', style: mono(size: 11, color: Palette.dim)),
      ]),
      const SizedBox(height: 8),
      Semantics(
        label: 'Ghost proximity ${proximity.round()} percent',
        child: Row(children: [
          for (var i = 0; i < segments; i++)
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 16,
                margin: const EdgeInsets.symmetric(horizontal: 1.5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: i < lit
                      ? (i < 8 ? Palette.ecto : (i < 14 ? Palette.candle : Palette.blood))
                      : Palette.bone.withValues(alpha: 0.07),
                  boxShadow: i < lit && i >= 14 ? [BoxShadow(color: Palette.blood.withValues(alpha: 0.7), blurRadius: 8)] : null,
                ),
              ),
            ),
        ]),
      ),
      const SizedBox(height: 8),
      Text(
        '$status${showName ? ' — ${ghost!.ghostName}' : ''}',
        style: mono(size: 12, color: chasing || proximity > 70 ? Palette.blood : Palette.dim),
      ),
    ]);
  }
}

const _itemIcon = {ItemType.ritualSalt: '◇', ItemType.relic: '✝', ItemType.candle: '♨', ItemType.talisman: '✶'};

class InventoryPanel extends StatelessWidget {
  const InventoryPanel({super.key, required this.items, required this.session, required this.stash, required this.needed});
  final List<Item> items;
  final ItemQuantities session;
  final ItemQuantities stash;
  final ItemQuantities needed;

  @override
  Widget build(BuildContext context) {
    final ids = {...needed.keys, ...session.keys, ...stash.keys}.toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('RITUAL ITEMS', style: label()),
      const SizedBox(height: 8),
      if (ids.isEmpty) Text('Nothing yet.', style: mono(size: 12, color: Palette.dim)),
      for (final id in ids)
        if (items.where((i) => i.itemId == id).firstOrNull case final item?)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Tooltip(
              message: item.description,
              child: Builder(builder: (context) {
                final have = (session[id] ?? 0) + (stash[id] ?? 0);
                final need = needed[id];
                final ok = need != null && have >= need;
                return Row(children: [
                  SizedBox(
                    width: 20,
                    child: Text(_itemIcon[item.itemType]!,
                        style: mono(color: ok ? Palette.ecto : (need != null ? Palette.candle : Palette.dim))),
                  ),
                  Expanded(child: Text(item.itemName, style: mono(size: 13), overflow: TextOverflow.ellipsis)),
                  Text('$have${need != null ? ' / $need' : ''}', style: mono(size: 12, color: ok ? Palette.ecto : Palette.dim)),
                ]);
              }),
            ),
          ),
      if (session.isNotEmpty) ...[
        const SizedBox(height: 6),
        Text('Found this run: banked when you leave alive.', style: mono(size: 11, color: Palette.dim)),
      ],
    ]);
  }
}

class EventLog extends StatelessWidget {
  const EventLog({super.key, required this.log});
  final List<LogEntry> log;

  static const _tone = {
    LogTone.info: Color(0xB3E8E4D8),
    LogTone.good: Palette.ecto,
    LogTone.bad: Palette.candle,
    LogTone.ghost: Palette.blood,
  };

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('STREAM LOG', style: label()),
      const SizedBox(height: 8),
      for (var i = 0; i < log.length; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Opacity(
            opacity: (1 - i * 0.14).clamp(0.2, 1.0).toDouble(),
            child: Text(
              log[i].text,
              style: mono(
                size: 12,
                color: _tone[log[i].tone]!,
                weight: log[i].tone == LogTone.ghost ? FontWeight.bold : null,
              ).copyWith(height: 1.5),
            ),
          ),
        ),
    ]);
  }
}
